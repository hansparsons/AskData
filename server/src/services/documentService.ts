import { ProcessedData, processDocument, processSpreadsheet, storeProcessedData } from '../utils/fileProcessor';
import { OllamaService } from './ollamaService';
import { OpenAIService } from './openaiService';
import { ModelService, isOpenAIModel } from './modelService';
import { sequelize } from '../db';

interface SchemaColumn {
  Field: string;
}

interface Schema {
  tableName: string;
  actualTableName: string;
  originalName: string;
  columns: SchemaColumn[];
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  availableColumns?: string[];
}

export class DocumentService {
  private ollamaService: OllamaService | null = null;
  private openaiService: OpenAIService | null = null;
  private modelService: ModelService;
  private selectedModel: string;

  constructor(model?: string) {
    this.modelService = new ModelService();
    this.selectedModel = model || 'llama3';
    
    // Initialize the appropriate service based on the model
    this.initializeService(this.selectedModel);
  }
  
  private initializeService(model: string): void {
    // Check if it's an OpenAI model
    if (model === 'gpt-4o') {
      const apiKey = this.modelService.getOpenAIApiKey();
      if (apiKey) {
        this.openaiService = new OpenAIService(apiKey, model);
        this.ollamaService = null;
      } else {
        // Instead of throwing an error, set services to null
        // The error will be handled when methods are called
        this.openaiService = null;
        this.ollamaService = null;
        console.warn('OpenAI API key not set for model:', model);
      }
    } else {
      // It's an Ollama model
      this.ollamaService = new OllamaService(model);
      this.openaiService = null;
    }
  }
  
  setOpenAIApiKey(apiKey: string): void {
    this.modelService.setOpenAIApiKey(apiKey);
    if (this.selectedModel === 'gpt-4o' && apiKey) {
      this.openaiService = new OpenAIService(apiKey, this.selectedModel);
    }
  }

  async processFile(filePath: string, fileName: string, fileType: string): Promise<ProcessedData> {
    // Verify database connection before processing
    try {
      await sequelize.authenticate();
    } catch (error) {
      console.error('Database connection error:', error);
      throw new Error('Database connection failed. Please try again later.');
    }
    if (!filePath || !fileName || !fileType) {
      throw new Error('Missing required parameters: filePath, fileName, or fileType');
    }

    try {
      let processedData: ProcessedData;

      switch (fileType.toLowerCase()) {
        case 'xlsx':
        case 'xls':
          processedData = await processSpreadsheet(filePath, fileName);
          await storeProcessedData(processedData, 'spreadsheet');
          break;

        case 'docx':
          processedData = await processDocument(filePath, fileName, 'document');
          await storeProcessedData(processedData, 'document');
          break;

        case 'pdf':
          processedData = await processDocument(filePath, fileName, 'pdf');
          await storeProcessedData(processedData, 'document');
          break;

        default:
          throw new Error(`Unsupported file type: ${fileType}`);
      }

      return processedData;
    } catch (error) {
      console.error('Error processing file:', error);
      if (error instanceof Error) {
        throw new Error(`File processing failed: ${error.message}`);
      }
      throw new Error('An unexpected error occurred during file processing');
    }
  }

  async executeQuery(question: string, selectedSources: string[]): Promise<{ sql: string; results: any; answer: string }> {
    if (!question || !selectedSources?.length) {
      throw new Error('Question and selected sources are required');
    }

    let sqlQuery = '';
    let schemas: Schema[] = [];

    try {
      // Verify database connection
      await sequelize.authenticate();

      // Get schemas for selected sources
      schemas = await this.getSourceSchemas(selectedSources);

      if (!schemas.length) {
        throw new Error('No valid schemas found for the selected sources');
      }

      // Generate SQL query using the appropriate LLM service
      if (this.openaiService && this.selectedModel === 'gpt-4o') {
        sqlQuery = await this.openaiService.generateSQLQuery(schemas, question);
      } else if (this.ollamaService) {
        sqlQuery = await this.ollamaService.generateSQLQuery(schemas, question);
      } else {
        // Check if we're trying to use OpenAI model without API key
        if (this.selectedModel === 'gpt-4o') {
          throw new Error('OpenAI API key is required for using GPT-4o model. Please set your API key first.');
        } else {
          throw new Error('No language model service available');
        }
      }

      if (!sqlQuery?.trim()) {
        throw new Error('Failed to generate SQL query');
      }

      // Ensure consistent table names by replacing any variants with the actual table names
      schemas.forEach((schema: Schema) => {
        // Create a more robust regex that can match the table name with different underscore patterns
        // This will match the table name regardless of how many underscores are used
        const tableNameBase = schema.tableName.replace(/_{1,}/g, '_');
        // Escape special regex characters in the table name
        const escapedTableName = tableNameBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Replace underscores with a pattern that matches 1-3 underscores
        const tableNamePattern = escapedTableName.replace(/_/g, '[_]{1,3}');
        const tableNameRegex = new RegExp(`\\b${tableNamePattern}\\b`, 'gi');
        
        // Log the table name replacement for debugging
        console.log(`Ensuring table name consistency: Replacing matches of ${tableNameRegex} with ${schema.tableName}`);
        
        // Replace all variants with the actual table name
        sqlQuery = sqlQuery.replace(tableNameRegex, schema.tableName);
      });
      
      // Additional check to ensure table names are correctly used
      schemas.forEach((schema: Schema) => {
        // Also check for table names without backticks and replace them
        const plainTableName = schema.tableName.replace(/`/g, '');
        if (sqlQuery.includes(plainTableName) && !sqlQuery.includes('`' + plainTableName + '`')) {
          sqlQuery = sqlQuery.replace(new RegExp(`\\b${plainTableName}\\b`, 'g'), '`' + plainTableName + '`');
        }
      });

      // Fix value quoting for values containing spaces
      sqlQuery = sqlQuery.replace(/['"](.*?)['"](?=\s*[;)]|$)/g, (match, value) => {
        if (value.includes(' ')) {
          // Remove any existing backticks and add proper quotes
          value = value.replace(/`/g, '').trim();
          return `'${value}'`;
        }
        return match;
      });
      
      // Fix GROUP BY issues for MySQL's ONLY_FULL_GROUP_BY mode
      sqlQuery = this.fixGroupByIssues(sqlQuery);
      
      // Log the final SQL query for debugging
      console.log('Final SQL query:', sqlQuery);

      // Validate column names in the SQL query
      const validationResult = this.validateColumnNames(sqlQuery, schemas);
      if (!validationResult.valid) {
        throw new Error(`SQL validation failed: ${validationResult.error}. Available columns are: ${validationResult.availableColumns?.join(', ') || 'None'}`);
      }

      // Execute the query
      const [results] = await sequelize.query(sqlQuery);

      // Generate natural language response using the appropriate LLM service
      let answer: string;
      
      if (this.openaiService && this.selectedModel === 'gpt-4o') {
        answer = await this.openaiService.generateNaturalLanguageResponse(question, results);
      } else if (this.ollamaService) {
        answer = await this.ollamaService.generateNaturalLanguageResponse(question, results);
      } else {
        // Check if we're trying to use OpenAI model without API key
        if (this.selectedModel === 'gpt-4o') {
          throw new Error('OpenAI API key is required for using GPT-4o model. Please set your API key first.');
        } else {
          throw new Error('No language model service available');
        }
      }

      return {
        sql: sqlQuery,
        results,
        answer: answer || 'No response generated'
      };
    } catch (error: any) {
      console.error('Error executing query:', error);
      
      // Check for specific database errors related to column issues
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        // Handle unknown column errors specifically
        if (errorMessage.includes('Unknown column')) {
          // Extract the column name from the error message if possible
          const columnMatch = errorMessage.match(/Unknown column '([^']+)'/);
          const columnName = columnMatch ? columnMatch[1] : 'unknown';
          
          // Get available columns from schemas to provide helpful suggestions
          const availableColumns = schemas?.flatMap((schema: Schema) => 
            schema.columns.map((col: SchemaColumn) => col.Field)
          ) || [];
          
          throw new Error(`Query execution failed: Unknown column '${columnName}' in query. Available columns are: ${availableColumns.join(', ')}`);
        }
        
        // Handle other SQL errors
        throw new Error(`Query execution failed: ${error.message}`);
      }
      
      throw new Error('An unexpected error occurred during query execution');
    }
  }

  /**
   * Get schemas for the selected data sources
   */
  private async getSourceSchemas(sourceNames: string[]): Promise<Schema[]> {
    const schemas: Schema[] = [];
    
    try {
      for (const sourceName of sourceNames) {
        // Use the original table name without sanitization
        const tableName = sourceName
          .replace(/^\d{13}-/, '') // remove timestamp prefix
          .replace(/\.[^/.]+$/, ''); // remove file extension
        
        try {
          // Query the table using the original name
          const [result] = await sequelize.query(
            `SHOW COLUMNS FROM \`${tableName}\``,
            { raw: true }
          );
          
          if (result) {
            schemas.push({
              tableName: tableName,
              actualTableName: tableName,
              originalName: sourceName,
              columns: result as SchemaColumn[]
            });
          }
        } catch (error) {
          console.warn(`Failed to find table with name: ${tableName}`);
          throw error;
        }
      }
      
      return schemas;
    } catch (error) {
      console.error('Error getting source schemas:', error);
      throw error;
    }
  }

  /**
   * Validates column names in the SQL query against the available schema
   * @param sqlQuery The SQL query to validate
   * @param schemas The available schemas
   * @returns Object indicating if validation passed and error details if it failed
   */
  /**
   * Fixes GROUP BY issues for MySQL's ONLY_FULL_GROUP_BY mode by ensuring all non-aggregated
   * columns in the SELECT clause are included in the GROUP BY clause
   * @param sqlQuery The SQL query to fix
   * @returns The fixed SQL query
   */
  private fixGroupByIssues(sqlQuery: string): string {
    try {
      // Check if the query has MIN/MAX without GROUP BY
      const hasAggregate = /\b(MIN|MAX|AVG|SUM|COUNT)\s*\([^)]+\)/i.test(sqlQuery);
      const hasGroupBy = /\bGROUP\s+BY\b/i.test(sqlQuery);
      
      if (hasAggregate && !hasGroupBy) {
        // Extract non-aggregated columns from SELECT
        const selectMatch = sqlQuery.match(/\bSELECT\s+([^;)]*?)\s+FROM\b/i);
        if (!selectMatch) return sqlQuery;

        const selectPart = selectMatch[1];
        const nonAggregatedColumns = new Set<string>();

        // Extract table name from the query
        const fromMatch = sqlQuery.match(/\bFROM\s+[`]?([a-zA-Z0-9_]+)[`]?/i);
        const tableName = fromMatch ? fromMatch[1] : null;
        if (!tableName) return sqlQuery;

        // Find columns that are not part of aggregate functions
        const columnMatches = selectPart.match(/\b[`]?([a-zA-Z0-9_]+)[`]?(?!\s*\(|\s+AS\s+)\b(?![^(]*\))/gi);
        if (columnMatches) {
          columnMatches.forEach(match => {
            const column = match.replace(/[`'"]/g, '').toLowerCase();
            if (!column.match(/^(count|sum|avg|min|max|group_concat)$/i)) {
              nonAggregatedColumns.add(column);
            }
          });
        }

        // Extract the aggregate expression
        const aggregateMatch = selectPart.match(/\b(MIN|MAX|AVG|SUM|COUNT)\s*\([^)]+\)/i);
        if (aggregateMatch && nonAggregatedColumns.size > 0) {
          const aggregateExpr = aggregateMatch[0];
          const columns = Array.from(nonAggregatedColumns).map(col => `\`${col}\``).join(', ');
          
          // Create a subquery that first finds the maximum value
          const subquery = `SELECT ${aggregateExpr} AS agg_value FROM \`${tableName}\``;
          
          // Join with the original table to get the corresponding row
          return `SELECT ${columns}, (${aggregateExpr}) AS agg_value FROM \`${tableName}\` WHERE (${aggregateExpr}) = (${subquery}) LIMIT 1`;
        }
      }

      // Handle regular GROUP BY cases
      const groupByMatch = sqlQuery.match(/\bGROUP\s+BY\s+([^;)]*)/i);
      if (!groupByMatch) return sqlQuery;

      // Extract SELECT and GROUP BY parts
      const selectMatch = sqlQuery.match(/\bSELECT\s+([^;)]*?)\s+FROM\b/i);
      if (!selectMatch) return sqlQuery;

      const selectPart = selectMatch[1];
      let groupByPart = groupByMatch[1];

      // Extract columns from SELECT clause, excluding aggregated functions
      const selectColumns = new Set<string>();
      const selectColumnMatches = selectPart.match(/\b[`]?([a-zA-Z0-9_]+)[`]?(?!\s*\(|\s+AS\s+)\b/gi);
      if (selectColumnMatches) {
        selectColumnMatches.forEach(match => {
          const column = match.replace(/[`'"]/g, '').toLowerCase();
          if (!column.match(/^(count|sum|avg|min|max|group_concat)$/i)) {
            selectColumns.add(column);
          }
        });
      }

      // Extract existing GROUP BY columns
      const groupByColumns = new Set<string>();
      const groupByColumnMatches = groupByPart.match(/\b[`]?([a-zA-Z0-9_]+)[`]?\b/gi);
      if (groupByColumnMatches) {
        groupByColumnMatches.forEach(match => {
          groupByColumns.add(match.replace(/[`'"]/g, '').toLowerCase());
        });
      }

      // Add missing columns to GROUP BY
      selectColumns.forEach(column => {
        if (!groupByColumns.has(column.toLowerCase())) {
          groupByPart += groupByPart ? `, \`${column}\`` : `\`${column}\``;
        }
      });

      // Replace the original GROUP BY clause
      return sqlQuery.replace(/\bGROUP\s+BY\s+([^;)]*)/i, `GROUP BY ${groupByPart}`);
    } catch (error) {
      console.error('Error fixing GROUP BY issues:', error);
      return sqlQuery; // Return original query if there's an error
    }
  }

  private validateColumnNames(sqlQuery: string, schemas: Schema[]): ValidationResult {
    try {
      // Extract all column references from the query
      // This regex looks for column names in various SQL contexts
      const columnPattern = /\b[`]?([a-zA-Z0-9_]+)[`]?\b(?=\s*(?:[=<>]|IS|IN|LIKE|BETWEEN|\+|-|\*|\/|%|,|\)|$))/gi;
      const tableColumnPattern = /\b([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\b/gi;
      
      // Extract derived table aliases from subqueries
      const derivedTablePattern = /\bAS\s+([a-zA-Z0-9_]+)(?=\s*(?:,|$|\)))/gi;
      const derivedTableMatches = [...sqlQuery.matchAll(derivedTablePattern)];
      const derivedTableAliases = new Set<string>();
      derivedTableMatches.forEach(match => {
        derivedTableAliases.add(match[1].toLowerCase());
      });
      
      // Extract column names from the query
      const columnMatches = [...sqlQuery.matchAll(columnPattern)];
      const tableColumnMatches = [...sqlQuery.matchAll(tableColumnPattern)];
      
      // Combine all column names found
      const referencedColumns = new Set<string>();
      
      // Define SQL keywords to skip
      const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'HAVING', 'ORDER', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'ASC', 'DESC', 'LIMIT', 'OFFSET'];

      // Process column matches
      columnMatches.forEach(match => {
        const columnName = match[1];
        if (!sqlKeywords.includes(columnName.toUpperCase()) && !derivedTableAliases.has(columnName.toLowerCase())) {
          referencedColumns.add(columnName);
        }
      });

      // Process table.column matches
      tableColumnMatches.forEach(match => {
        const tableName = match[1].toLowerCase();
        const columnName = match[2];
        // Skip validation if the table name is a derived table alias
        if (!derivedTableAliases.has(tableName) && !sqlKeywords.includes(columnName.toUpperCase())) {
          referencedColumns.add(columnName);
        }
      });

      // Get all available columns from schemas
      const availableColumns = new Set<string>();
      schemas.forEach(schema => {
        schema.columns.forEach(column => {
          // Store the exact column name as it appears in the database
          availableColumns.add(column.Field);
          // Also store lowercase version for case-insensitive matching
          availableColumns.add(column.Field.toLowerCase());
        });
      });

      // Validate that all referenced columns exist in schemas
      const invalidColumns: string[] = [];
      referencedColumns.forEach(column => {
        // Check both exact match and lowercase match
        if (!availableColumns.has(column) && 
            !availableColumns.has(column.toLowerCase()) && 
            !sqlKeywords.includes(column.toUpperCase())) {
          invalidColumns.push(column);
        }
      });

      if (invalidColumns.length > 0) {
        return {
          valid: false,
          error: `Invalid column(s): ${invalidColumns.join(', ')}`,
          availableColumns: Array.from(availableColumns)
        };
      }

      return {
        valid: true
      };
    } catch (error) {
      console.error('Error validating column names:', error);
      return {
        valid: false,
        error: 'Failed to validate column names'
      };
    }
  }
}