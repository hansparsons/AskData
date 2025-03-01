import { ProcessedData, processDocument, processSpreadsheet, storeProcessedData } from '../utils/fileProcessor';
import { OllamaService } from './ollamaService';
import { OpenAIService } from './openaiService';
import { ModelService, isOpenAIModel } from './modelService';
import { sequelize } from '../db';

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
  
  private initializeService(model: string) {
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
  
  setOpenAIApiKey(apiKey: string) {
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

    try {
      // Verify database connection
      await sequelize.authenticate();

      // Get schemas for selected sources
      const schemas = await this.getSourceSchemas(selectedSources);

      if (!schemas.length) {
        throw new Error('No valid schemas found for the selected sources');
      }

      // Generate SQL query using the appropriate LLM service
      let sqlQuery: string;
      
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
      schemas.forEach(schema => {
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
      schemas.forEach(schema => {
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
      
      // Log the final SQL query for debugging
      console.log('Final SQL query:', sqlQuery);

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
    } catch (error) {
      console.error('Error executing query:', error);
      if (error instanceof Error) {
        throw new Error(`Query execution failed: ${error.message}`);
      }
      throw new Error('An unexpected error occurred during query execution');
    }
  }

  private async getSourceSchemas(sourceNames: string[]): Promise<any[]> {
    const schemas: any[] = [];
    
    try {
      for (const sourceName of sourceNames) {
        // Sanitize table name using the same logic as in fileProcessor
        let sanitizedTableName = sourceName
          .replace(/^\d{13}-/, '') // remove timestamp prefix
          .replace(/\.[^/.]+$/, '') // remove file extension
          .replace(/[^a-zA-Z0-9_]/g, '_') // replace special chars with underscore
          .replace(/^[0-9]/, 't$&') // prepend 't' if starts with number
          .toLowerCase(); // convert to lowercase for consistency
        
        try {
          // First try with the standard sanitized name
          const [result] = await sequelize.query(
            `SHOW COLUMNS FROM \`${sanitizedTableName}\``,
            { raw: true }
          );
          
          if (result) {
            schemas.push({
              tableName: sanitizedTableName, // Use sanitized table name instead of original name
              actualTableName: sanitizedTableName, // Store the actual table name for reference
              originalName: sourceName, // Keep the original name for display purposes
              columns: result
            });
          }
        } catch (error) {
          // If the first attempt fails, try with a truncated name
          // Some database systems might have table name length limitations
          console.warn(`Failed to find table with name: ${sanitizedTableName}, trying to find a matching version`);
          
          // Get all tables from the database
          const [tables] = await sequelize.query('SHOW TABLES', { raw: true });
          const tableList = tables.map((t: any) => {
            // Safely extract the first value from the object
            const values = Object.values(t);
            return values.length > 0 && values[0] != null ? values[0].toString().toLowerCase() : '';
          }).filter(Boolean); // Remove any empty strings
          
          // More flexible matching strategy:
          // 1. Try to find a table that starts with our sanitized name (for truncated names)
          // 2. Try to find a table that contains a significant portion of our sanitized name
          // This handles cases where the table name might have been modified differently
          let matchingTable = null;
          
          // First try to find a table that starts with our sanitized name (up to first 30 chars)
          const prefix = sanitizedTableName.substring(0, Math.min(sanitizedTableName.length, 30));
          matchingTable = tableList.find(tableName => tableName.startsWith(prefix));
          
          // If no match found and the name is long, try a more flexible approach
          if (!matchingTable && sanitizedTableName.length > 20) {
            // Get a significant portion of the name (first 20 chars) to use for matching
            const significantPortion = sanitizedTableName.substring(0, 20);
            matchingTable = tableList.find(tableName => tableName.includes(significantPortion));
          }
          
          if (matchingTable) {
            console.log(`Found matching table: ${matchingTable}`);
            const [result] = await sequelize.query(
              `SHOW COLUMNS FROM \`${matchingTable}\``,
              { raw: true }
            );
            
            if (result) {
              schemas.push({
                tableName: matchingTable, // Use the actual table name found in the database
                actualTableName: matchingTable, // Store the actual table name for reference
                originalName: sourceName, // Keep the original name for display purposes
                columns: result
              });
            }
          } else {
            console.error(`No matching table found for: ${sanitizedTableName}`);
          }
        }
      }

      return schemas;
    } catch (error) {
      console.error('Error fetching schemas:', error);
      if (error instanceof Error) {
        throw new Error(`Schema fetch failed: ${error.message}`);
      }
      throw new Error('An unexpected error occurred while fetching schemas');
    }
  }
}