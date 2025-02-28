import axios from 'axios';

const OLLAMA_API_BASE_URL = 'http://127.0.0.1:11434';  // Base URL for Ollama API (using explicit IPv4 address)
const OLLAMA_API_GENERATE_ENDPOINT = '/api/generate';  // Endpoint for generation requests
const DEFAULT_MODEL = 'llama3';

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
  private model: string;

  constructor(model?: string) {
    this.model = model || DEFAULT_MODEL;
  }

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

      const prompt = `Given these table schemas:\n${schemaText}\n\nGenerate a SQL query to answer this question: ${question}\n\nIMPORTANT RULES:\n1. Use ONLY the sanitized table names (before 'original name:') in your SQL query, NOT the original file names.\n2. ALWAYS enclose column names in backticks (\`column_name\`), especially when column names contain spaces.\n3. For column names with spaces like "Delivery end date and time", use \`Delivery end date and time\` - NEVER split the backticks around spaces.\n4. For mathematical operations on columns with spaces, ensure proper syntax: \`column with spaces\` - \`another column\`.\n5. CRITICAL: When performing operations on columns with spaces, ensure the ENTIRE column name is enclosed in a SINGLE pair of backticks.\n   CORRECT: SELECT \`Delivery end date and time\` - \`Delivery start date and time\` AS delivery_duration\n   INCORRECT: SELECT \`Delivery end date\` and time - \`Delivery start date\` and time AS delivery_duration\n6. Ensure all SQL syntax is valid for MySQL.\n7. CRITICAL: Return ONLY the specific data needed to answer the question. Do not include unnecessary columns or rows.\n8. NEVER use SELECT * - this is strictly prohibited. Always specify only the exact columns needed to answer the question.\n9. Use appropriate WHERE clauses, aggregations, and filtering to limit the result set to only what's required.\n10. If the question asks for a specific number of results (e.g., "top 5"), use LIMIT appropriately.\n11. If the question asks for data within a specific time range or category, ensure your query filters accordingly.\n12. IMPORTANT: Keep the result set focused and minimal. Avoid returning large datasets with unnecessary information.\n13. When aggregating data, use GROUP BY only on relevant dimensions that directly relate to the question.\n14. If the question asks for a specific calculation or metric, return ONLY the columns needed for that calculation.\n15. For questions about trends or patterns, return only the data points needed to identify those trends.\n16. For questions about comparisons, return only the specific items being compared and the relevant metrics.\n17. ALWAYS analyze the question carefully to determine the minimum set of columns required to provide a complete answer.\n\nRespond with ONLY the SQL query, no explanations. If you cannot generate a valid SQL query, respond with 'INVALID_QUERY' and explain why.`;

      const response = await this.sendToOllama(prompt);
      const cleanedResponse = this.extractSQLQuery(response);
      
      if (cleanedResponse === 'INVALID_QUERY') {
        throw new Error(`Could not generate SQL query: ${response.replace('INVALID_QUERY', '').trim()}. Please try rephrasing your question.`);
      }
      
      // Additional validation to ensure we're not using SELECT *
      if (cleanedResponse.match(/\bSELECT\s+\*/i)) {
        console.warn('Query contains SELECT * - modifying to be more specific');
        // This is a fallback - ideally the LLM should not generate SELECT * queries
        // We'll try to get the LLM to fix it by sending a follow-up prompt
        const fixPrompt = `The following SQL query uses SELECT * which returns too much data:\n\n${cleanedResponse}\n\nRewrite this query to select ONLY the specific columns needed to answer the original question: "${question}".\nDo not use SELECT * under any circumstances. Respond with ONLY the improved SQL query.`;
        
        const fixedResponse = await this.sendToOllama(fixPrompt);
        const fixedQuery = this.extractSQLQuery(fixedResponse);
        
        // If we still have SELECT *, we'll need to handle it differently
        if (fixedQuery.match(/\bSELECT\s+\*/i)) {
          console.error('LLM still generated SELECT * query after correction attempt');
          // We could implement a more sophisticated fallback here if needed
        } else {
          return fixedQuery;
        }
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
      // Check if the question is asking for a visualization
      const isVisualizationRequest = this.isChartRequest(question);
      
      let prompt;
      if (isVisualizationRequest) {
        prompt = `Question: ${question}\n\nData: ${JSON.stringify(queryResult)}\n\nThe user is requesting a visualization. Provide a natural language response to the question based on the query results. Include insights about what type of chart would be most appropriate for this data and what patterns or trends are visible.`;
      } else {
        prompt = `Question: ${question}\n\nData: ${JSON.stringify(queryResult)}\n\nProvide a natural language response to the question based on the query results.`;
      }

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

  /**
   * Generate chart data that directly relates to the original question
   * Uses both query results and natural language answer for better context
   */
  async generateChartData(question: string, data: any, chartType: string): Promise<any> {
    if (!question || !data || !chartType) {
      throw new Error('Invalid parameters for chart data generation');
    }

    try {
      // Check if data contains both results and natural language answer
      const queryResult = data.results || data;
      const naturalLanguageAnswer = data.answer || null;
      
      if (!Array.isArray(queryResult)) {
        throw new Error('Query results must be an array');
      }
      
      // Extract column names to help the LLM understand the data structure
      const columnNames = queryResult.length > 0 ? Object.keys(queryResult[0]) : [];
      
      // Enhanced prompt that emphasizes the importance of using both the results and answer
      const prompt = `ORIGINAL QUESTION: "${question}"

DATA STRUCTURE:
- Column names available: ${columnNames.join(', ')}
- Number of data points: ${queryResult.length}
- Sample data point: ${JSON.stringify(queryResult[0])}

FULL RAW DATA: ${JSON.stringify(queryResult)}

${naturalLanguageAnswer ? `NATURAL LANGUAGE ANSWER: ${naturalLanguageAnswer}

` : ''}
CHART TYPE REQUESTED: ${chartType}

TASK: Create a ${chartType} chart that DIRECTLY ANSWERS the user's original question "${question}". The chart must visualize ONLY the specific data points that address what the user asked about.

CRITICAL INSTRUCTIONS:
1. QUESTION-CENTRIC APPROACH: Your visualization MUST be designed specifically to answer "${question}" - this is your primary objective
2. EXTRACT QUESTION INTENT: Carefully analyze what the user is actually asking for - identify the specific metrics, comparisons, trends, or relationships they want to understand
3. ANALYZE DATA SOURCES: 
   - CAREFULLY examine the raw query results to identify the exact data points that answer the question
   - If provided, use the natural language answer as context to understand what insights are most relevant
   - ONLY include data points that directly relate to answering the original question
4. DATA TRANSFORMATION: 
   - If the raw data doesn't directly answer the question, perform necessary aggregations, calculations, or filtering
   - For time-based questions, ensure proper chronological ordering
   - For comparison questions, organize data to clearly show the comparison
5. VISUALIZATION SPECIFICS:
   - Choose axes/labels that explicitly relate to the question's key terms and concepts
   - The chart title should incorporate key terms from the original question
   - Dataset labels should directly reference what the user asked about
6. RELEVANCE CHECK: Before finalizing, verify that someone viewing this chart would immediately understand how it answers "${question}"

Provide a JSON response with the following structure:
{
  "chartData": {
    "labels": [], // Array of labels for the chart (x-axis for bar/line charts, segment labels for pie charts)
    "datasets": [
      {
        "label": "string", // Dataset label that explicitly references the question
        "data": [] // Array of numeric values corresponding to the labels
      }
    ]
  },
  "title": "string", // A descriptive title that incorporates key terms from the original question
  "insights": "string", // Brief insights explaining how this chart specifically answers the original question
  "questionContext": "string" // A brief explanation of how this visualization directly relates to what the user asked
}

IMPORTANT: Your response MUST be valid JSON. Do not include any text before or after the JSON object. Ensure all strings are properly quoted and all JSON syntax is correct.

Respond ONLY with the JSON object, no additional text.`;

      const response = await this.sendToOllama(prompt);
      if (!response?.trim()) {
        throw new Error('Empty response from LLM');
      }

      try {
        // Enhanced JSON extraction with multiple fallback mechanisms
        let jsonStr = '';
        let chartData = null;
        
        // First attempt: Try to parse the entire response as JSON
        try {
          chartData = JSON.parse(response.trim());
          return chartData;
        } catch (parseError) {
          console.log('Full response is not valid JSON, trying to extract JSON portion...');
        }
        
        // Second attempt: Extract JSON using regex pattern matching
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
          try {
            chartData = JSON.parse(jsonStr);
            return chartData;
          } catch (matchError) {
            console.log('Extracted JSON portion is not valid, trying to fix common issues...');
          }
        }
        
        // Third attempt: Try to fix common JSON formatting issues
        if (jsonStr) {
          // Fix unescaped quotes within strings
          const fixedJson = jsonStr
            .replace(/"([^"]*)":\s*"([^"]*)"([^"]*)"/g, '"$1": "$2\\"$3"') // Fix quotes in values
            .replace(/([\{\,]\s*"[^"]+"\s*:\s*)(\w+)(\s*[\,\}])/g, '$1"$2"$3'); // Quote unquoted values
          
          try {
            chartData = JSON.parse(fixedJson);
            return chartData;
          } catch (fixError) {
            console.log('Could not fix JSON formatting issues');
          }
        }
        
        // Fourth attempt: Create a minimal valid chart data structure
        console.error('All JSON parsing attempts failed, creating fallback chart data');
        console.log('Raw LLM response:', response);
        
        // Extract any useful information we can from the response
        const title = question || 'Chart';
        const labels = queryResult.map((item, index) => {
          const firstKey = Object.keys(item)[0];
          return item[firstKey] || `Item ${index + 1}`;
        });
        const values = queryResult.map((item) => {
          const numericKeys = Object.keys(item).filter(key => 
            typeof item[key] === 'number' || !isNaN(Number(item[key]))
          );
          return numericKeys.length > 0 ? Number(item[numericKeys[0]]) : 1;
        });
        
        // Create a minimal valid chart data structure
        return {
          chartData: {
            labels: labels,
            datasets: [
              {
                label: columnNames.length > 1 ? columnNames[1] : 'Value',
                data: values
              }
            ]
          },
          title: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart: ${title}`,
          insights: 'Chart generated from query results',
          questionContext: `Visualization of data for question: ${question}`
        };
      } catch (parseError) {
        console.error('Error parsing chart data JSON:', parseError);
        console.log('Raw response:', response);
        throw new Error('Failed to parse chart data from LLM response');
      }
    } catch (error) {
      console.error('Error generating chart data:', error);
      throw error instanceof Error ? error : new Error('Failed to generate chart data');
    }
  }
  
  /**
   * Determines if a question is requesting a chart or visualization
   */
  private isChartRequest(question: string): boolean {
    const chartKeywords = [
      'chart', 'graph', 'plot', 'visualization', 'visualize',
      'bar chart', 'line chart', 'pie chart', 'histogram',
      'show me a chart', 'display a graph', 'create a visualization'
    ];
    
    const lowercaseQuestion = question.toLowerCase();
    return chartKeywords.some(keyword => lowercaseQuestion.includes(keyword));
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
        model: this.model,
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
          // Expanded list of SQL keywords and clauses that shouldn't be quoted
          const sqlKeywords = [
            'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'AS', 'AND', 'OR', 'ON', 'JOIN',
            'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN',
            'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'DISTINCT', 'INSERT INTO', 'VALUES',
            'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE',
            'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION', 'TRIGGER', 'CASCADE', 'TEMPORARY',
            'IS NULL', 'IS NOT NULL', 'BETWEEN', 'IN', 'NOT IN', 'EXISTS', 'NOT EXISTS',
            'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'LIKE', 'NOT LIKE'
          ];
          
          // Check if the column contains any SQL keywords
          const containsSqlKeyword = sqlKeywords.some(keyword => 
            col.toUpperCase().includes(keyword) || 
            keyword.includes(col.toUpperCase())
          );
          
          if (!containsSqlKeyword) {
            // Simple string replacement for safety
            cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${col}\\b`, 'g'), `\`${col}\``);
          }
        }
      }
      
      // Final check to remove any backticks around SQL keywords
      const backtickKeywordsRegex = /`(SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|JOIN|AND|OR|ON|AS|UNION|DISTINCT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|SET|VALUES|IN|BETWEEN|LIKE|CASE|WHEN|THEN|ELSE|END)`/gi;
      cleanedQuery = cleanedQuery.replace(backtickKeywordsRegex, '$1');
      
      // Check for SELECT * queries and add warning log
      const selectStarRegex = /SELECT\s+\*/i;
      if (selectStarRegex.test(cleanedQuery)) {
        console.warn('WARNING: Query uses SELECT * which may return excessive data:', cleanedQuery);
      }
      
      // Fix MySQL syntax issue with wildcard (*) and calculated columns
      // In MySQL, when using both calculated columns and wildcard (*), the wildcard must come first
      const selectStarWithCalculatedColumnsRegex = /SELECT\s+([^*,\n]+)\s*,\s*(\*)/i;
      if (selectStarWithCalculatedColumnsRegex.test(cleanedQuery)) {
        console.log('Found calculated columns before wildcard (*), reordering...');
        cleanedQuery = cleanedQuery.replace(selectStarWithCalculatedColumnsRegex, 'SELECT $2, $1');
      }
      
      // Remove any explanatory comments that follow the SQL query
      // SQL queries typically end with a semicolon
      const sqlParts = cleanedQuery.split(';');
      if (sqlParts.length > 1) {
        // Keep only the first part (the actual SQL query) and add back the semicolon
        cleanedQuery = sqlParts[0].trim() + ';';
      }
      
      // Alternative approach: Look for common patterns that indicate explanatory text
      // This helps catch cases where the semicolon might be missing
      const explanationPatterns = [
        /\n\s*\n[\s\S]*$/,  // Double newline followed by text
        /\n--[\s\S]*$/,   // SQL comment marker
        /\n\/\*[\s\S]*$/,  // SQL block comment
        /\nThis query[\s\S]*$/i,  // Explanatory text starting with "This query"
        /\nThe above[\s\S]*$/i,   // Explanatory text starting with "The above"
        /\nHere[\s\S]*$/i        // Explanatory text starting with "Here"
      ];
      
      for (const pattern of explanationPatterns) {
        cleanedQuery = cleanedQuery.replace(pattern, '');
      }
      
      // Ensure the query ends with a semicolon
      if (!cleanedQuery.trim().endsWith(';')) {
        cleanedQuery = cleanedQuery.trim() + ';';
      }
      
      console.log('Fixed query:', cleanedQuery);
      return cleanedQuery;
    } catch (error) {
      console.error('Error extracting SQL query:', error);
      throw new Error('Failed to extract SQL query from LLM response');
    }
  }
}