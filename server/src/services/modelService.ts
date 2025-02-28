import axios from 'axios';

const OLLAMA_API_BASE_URL = 'http://127.0.0.1:11434';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: any;
}

export class ModelService {
  /**
   * Fetches the list of available models from Ollama
   */
  async getAvailableModels(): Promise<OllamaModel[]> {
    try {
      const response = await axios.get(`${OLLAMA_API_BASE_URL}/api/tags`, {
        timeout: 5000 // 5 seconds timeout
      });
      
      if (response.status === 200 && response.data && Array.isArray(response.data.models)) {
        return response.data.models;
      }
      
      console.error('Invalid response format from Ollama API:', response.data);
      return [];
    } catch (error) {
      console.error('Error fetching available models:', error);
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new Error('Unable to connect to Ollama service. Please ensure it is running at http://127.0.0.1:11434.');
      }
      throw error;
    }
  }
}