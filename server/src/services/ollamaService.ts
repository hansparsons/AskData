import axios from 'axios';

const OLLAMA_API_BASE_URL = 'http://127.0.0.1:11434';  // Base URL for Ollama API (using explicit IPv4 address)
const OLLAMA_API_GENERATE_ENDPOINT = '/api/generate';  // Endpoint for generation requests
const MODEL = 'llama3';

interface OllamaResponse {
  response: string;
  done: boolean;
  done_reason?: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaService {
  constructor() {}

  async generateSQLQuery(schemas: any[], question: string): Promise<string> {
    if (!question || !schemas?.length) {
      throw new Error('Question and schemas are required');
    }

    try {
      // Create a mapping of original table names to sanitized table names
      const tableNameMap: Record<string, string> = {};
      
      const schemaText = schemas.map(schema => {
        if (!schema?.columns) {
          throw new Error(`Invalid schema for table: ${schema.tableName}`);
        }
        
        // Sanitize table name using the same logic as in fileProcessor
        const sanitizedTableName = schema.tableName
          .replace(/^\d{13}-/, '') // remove timestamp prefix
          .replace(/\.[^/.]+$/, '') // remove file extension
          .replace(/[^a-zA-Z0-9_]/g, '_') // replace special chars with underscore
          .replace(/^[0-9]/, 't$&') // prepend 't' if starts with number
          .toLowerCase(); // convert to lowercase for consistency
        
        // Store the mapping
        tableNameMap[schema.tableName] = sanitizedTableName;
        
        return `Table: ${sanitizedTableName} (original name: ${schema.tableName})\nColumns: ${schema.columns.map((col: any) => 
          `\`${col.Field}\` (${col.Type})`
        ).join(', ')}`;
      }).join('\n\n');

      const prompt = `Given these table schemas:\n${schemaText}\n\nGenerate a SQL query to answer this question: ${question}\n\nIMPORTANT RULES:\n1. Use ONLY the sanitized table names (before 'original name:') in your SQL query, NOT the original file names.\n2. ALWAYS enclose column names in backticks (\`column_name\`), especially when column names contain spaces.\n3. For column names with spaces like "Delivery end date and time", use \`Delivery end date and time\` - NEVER split the backticks around spaces.\n4. For mathematical operations on columns with spaces, ensure proper syntax: \`column with spaces\` - \`another column\`.\n5. CRITICAL: When performing operations on columns with spaces, ensure the ENTIRE column name is enclosed in a SINGLE pair of backticks.\n   CORRECT: SELECT \`Delivery end date and time\` - \`Delivery start date and time\` AS delivery_duration\n   INCORRECT: SELECT \`Delivery end date\` and time - \`Delivery start date\` and time AS delivery_duration\n6. Ensure all SQL syntax is valid for MySQL.\n\nRespond with ONLY the SQL query, no explanations. If you cannot generate a valid SQL query, respond with 'INVALID_QUERY' and explain why.`;

      const response = await this.sendToOllama(prompt);
      const cleanedResponse = this.extractSQLQuery(response);
      
      if (cleanedResponse === 'INVALID_QUERY') {
        throw new Error(`Could not generate SQL query: ${response.replace('INVALID_QUERY', '').trim()}. Please try rephrasing your question.`);
      }
      
      return cleanedResponse;
    } catch (error) {
      console.error('Error generating SQL query:', error);
      if (error instanceof Error) {
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error('Unable to connect to the LLM service. Please ensure Ollama is running and try again.');
        }
        throw error;
      }
      throw new Error('Failed to generate SQL query. Please try rephrasing your question.');
    }
  }

  async generateNaturalLanguageResponse(question: string, queryResult: any[]): Promise<string> {
    if (!question || !Array.isArray(queryResult)) {
      throw new Error('Invalid parameters for natural language response generation');
    }

    try {
      const prompt = `Question: ${question}\n\nData: ${JSON.stringify(queryResult)}\n\nProvide a natural language response to the question based on the query results.`;

      const response = await this.sendToOllama(prompt);
      if (!response?.trim()) {
        throw new Error('Empty response from LLM');
      }
      return response;
    } catch (error) {
      console.error('Error generating natural language response:', error);
      throw error instanceof Error ? error : new Error('Failed to generate natural language response');
    }
  }

  private async sendToOllama(prompt: string): Promise<string> {
    if (!prompt?.trim()) {
      throw new Error('Empty prompt provided');
    }

    try {
      // First check if Ollama service is available
      try {
        await this.checkOllamaAvailability();
      } catch (error) {
        console.error('Ollama availability check failed:', error);
        throw new Error('Unable to connect to Ollama service. Please ensure it is running at http://127.0.0.1:11434.');
      }

      const apiUrl = `${OLLAMA_API_BASE_URL}${OLLAMA_API_GENERATE_ENDPOINT}`;
      console.log(`Sending request to Ollama API at ${apiUrl}`);
      
      const requestData = {
        model: MODEL,
        prompt,
        stream: false
      };
      
      console.log('Request payload:', JSON.stringify(requestData));
      
      const response = await axios.post<OllamaResponse>(apiUrl, requestData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 seconds timeout
      });

      console.log('Ollama API response status:', response.status);
      
      if (!response?.data) {
        console.error('Empty response data from Ollama API');
        throw new Error('Empty response data from Ollama API');
      }
      
      if (!response.data.response) {
        console.error('Invalid response format from Ollama API:', response.data);
        throw new Error('Invalid response from Ollama API: Missing response field');
      }

      return response.data.response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          code: error.code,
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Unable to connect to Ollama service. Please ensure it is running at http://127.0.0.1:11434.');
        }
        
        if (error.response) {
          throw new Error(`Ollama API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
        }
        
        throw new Error(`Ollama API error: ${error.message}`);
      }
      console.error('Error calling Ollama:', error);
      throw new Error('Failed to process with LLM');
    }
  }

  /**
   * Check if the Ollama service is available by making a request to the version endpoint
   */
  private async checkOllamaAvailability(): Promise<boolean> {
    try {
      const versionUrl = `${OLLAMA_API_BASE_URL}/api/version`;
      console.log(`Checking Ollama availability at ${versionUrl}`);
      
      const response = await axios.get(versionUrl, {
        timeout: 5000 // 5 seconds timeout for quick check
      });
      
      if (response.status === 200) {
        console.log('Ollama service is available');
        return true;
      }
      
      console.error(`Ollama service check failed with status: ${response.status}`);
      return false;
    } catch (error) {
      console.error('Error checking Ollama availability:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Ollama service connection refused. Please ensure Ollama is running at http://127.0.0.1:11434.');
        }
        throw new Error(`Failed to connect to Ollama service: ${error.message}`);
      }
      throw new Error('Failed to check Ollama service availability');
    }
  }

  private extractSQLQuery(response: string): string {
    if (!response?.trim()) {
      throw new Error('Empty response from LLM');
    }

    try {
      // Remove any markdown code block syntax and clean up the query
      let cleanedQuery = response
        .replace(/```sql\n|```/g, '')
        .trim();
      
      // Additional validation to catch common SQL syntax issues
      // Check for file extensions in table names which indicates the LLM didn't use the sanitized name
      if (cleanedQuery.match(/FROM\s+['"\`]?\d{13}-[\w-]+\.[a-zA-Z]+['"\`]?/i) || 
          cleanedQuery.match(/FROM\s+[\w-]+\.[a-zA-Z]+/i)) {
        console.error('SQL query contains unsanitized table names:', cleanedQuery);
        throw new Error('Generated SQL query contains invalid table names. Please try rephrasing your question.');
      }
      
      // Identify potential column names with spaces that need proper backtick quoting
      console.log('Original query:', cleanedQuery);
      
      // Fix common patterns where column names with spaces are improperly quoted
      // Pattern 1: Fix double backticks like ``Column name`` to `Column name`
      cleanedQuery = cleanedQuery.replace(/``([^`]+)``/g, '`$1`');
      
      // Pattern 2: Fix cases where backticks are split around spaces like `Column` name` to `Column name`
      cleanedQuery = cleanedQuery.replace(/`([^`\s]+)\s+([^`\s]+)`/g, '`$1 $2`');
      
      // Pattern 3: Fix cases with multiple words in column names that aren't properly quoted
      const columnsWithSpacesRegex = /(?<!`)(\w+(?:\s+\w+)+)(?!`)/g;
      const potentialColumns = cleanedQuery.match(columnsWithSpacesRegex);
      
      if (potentialColumns) {
        console.log('Found potential unquoted column names with spaces:', potentialColumns);
        
        // Replace each potential column with properly quoted version
        for (const col of potentialColumns) {
          // Skip SQL keywords and common phrases that shouldn't be quoted
          const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'AS', 'AND', 'OR', 'ON', 'JOIN'];
          if (!sqlKeywords.some(keyword => col.toUpperCase().includes(keyword))) {
            // Simple string replacement for safety
            cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${col}\\b`, 'g'), `\`${col}\``);
          }
        }
      }
      
      console.log('Fixed query:', cleanedQuery);
      return cleanedQuery;
    } catch (error) {
      console.error('Error extracting SQL query:', error);
      throw new Error('Failed to extract SQL query from LLM response');
    }
  }
}