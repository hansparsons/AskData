import { ProcessedData, processDocument, processSpreadsheet, storeProcessedData } from '../utils/fileProcessor';
import { OllamaService } from './ollamaService';
import { sequelize } from '../db';

export class DocumentService {
  private ollamaService: OllamaService;

  constructor(model?: string) {
    this.ollamaService = new OllamaService(model);
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

      // Generate SQL query using LLM
      const sqlQuery = await this.ollamaService.generateSQLQuery(schemas, question);

      if (!sqlQuery?.trim()) {
        throw new Error('Failed to generate SQL query');
      }

      // Execute the query
      const [results] = await sequelize.query(sqlQuery);

      // Generate natural language response
      const answer = await this.ollamaService.generateNaturalLanguageResponse(question, results);

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
        const sanitizedTableName = sourceName
          .replace(/^\d{13}-/, '') // remove timestamp prefix
          .replace(/\.[^/.]+$/, '') // remove file extension
          .replace(/[^a-zA-Z0-9_]/g, '_') // replace special chars with underscore
          .replace(/^[0-9]/, 't$&') // prepend 't' if starts with number
          .toLowerCase(); // convert to lowercase for consistency

        const [result] = await sequelize.query(
          `SHOW COLUMNS FROM \`${sanitizedTableName}\``,
          { raw: true }
        );
        if (result) {
          schemas.push({
            tableName: sourceName,
            columns: result
          });
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