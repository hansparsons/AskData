import axios from 'axios';

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

export class OpenAIService {
  private apiKey: string;
  private model: string;
  
  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateSQLQuery(schemas: any[], question: string): Promise<string> {
    if (!question || !schemas?.length) {
      throw new Error('Question and schemas are required');
    }

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      const schemaText = schemas.map(schema => {
        if (!schema?.columns) {
          throw new Error(`Invalid schema for table: ${schema.tableName}`);
        }
        
        // Always use the actual table name from the database
        const tableName = schema.actualTableName || schema.tableName;
        
        // Format columns for the prompt, ensuring proper backtick quoting for names with spaces
        const columnsText = schema.columns
          .map((col: any) => {
            const columnName = col.Field.includes(' ') ? `\`${col.Field}\`` : col.Field;
            return `${columnName} (${col.Type})`;
          })
          .join(', ');
        
        return `Table: ${tableName}\nColumns: ${columnsText}\n`;
      }).join('\n');

      const prompt = `You are a SQL expert. Given the following database schema:\n\n${schemaText}\n\nIMPORTANT RULES:\n1. Always use backticks (\`) around column names that contain spaces\n2. Use the exact column names as shown in the schema\n3. Do not create or reference columns that don't exist in the schema\n4. When performing date/time calculations, use the appropriate MySQL functions\n\nGenerate a SQL query to answer this question: "${question}"\n\nReturn ONLY the SQL query without any explanations or markdown formatting.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a SQL expert that generates precise SQL queries based on natural language questions and database schemas. Always use proper column name quoting.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid response from OpenAI API');
      }
    } catch (error) {
      console.error('Error generating SQL query with OpenAI:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`OpenAI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          throw new Error('No response received from OpenAI API. Please check your internet connection.');
        }
      }
      throw error;
    }
  }

  async generateNaturalLanguageResponse(question: string, results: any): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      const prompt = `Given the following query results:\n\n${JSON.stringify(results, null, 2)}\n\nProvide a natural language answer to the question: "${question}"`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant that explains data analysis results in clear, natural language.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content.trim();
      } else {
        throw new Error('Invalid response from OpenAI API');
      }
    } catch (error) {
      console.error('Error generating natural language response with OpenAI:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`OpenAI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          throw new Error('No response received from OpenAI API. Please check your internet connection.');
        }
      }
      throw error;
    }
  }

  async generateChartData(question: string, data: any, chartType: string): Promise<any> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
      const prompt = `Given the following data:\n\n${JSON.stringify(data, null, 2)}\n\nGenerate appropriate data for a ${chartType} chart to visualize the answer to the question: "${question}".\n\nReturn the result as a JSON object with 'labels' and 'datasets' properties suitable for Chart.js.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a data visualization expert that generates Chart.js compatible data structures.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        const content = response.data.choices[0].message.content.trim();
        // Extract JSON from the response
        const jsonMatch = content.match(/```json\n([\s\S]*)\n```/) || 
                         content.match(/```([\s\S]*)```/) || 
                         [null, content];
        
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (parseError) {
          console.error('Error parsing JSON from OpenAI response:', parseError);
          throw new Error('Failed to parse chart data from OpenAI response');
        }
      } else {
        throw new Error('Invalid response from OpenAI API');
      }
    } catch (error) {
      console.error('Error generating chart data with OpenAI:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`OpenAI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          throw new Error('No response received from OpenAI API. Please check your internet connection.');
        }
      }
      throw error;
    }
  }
}