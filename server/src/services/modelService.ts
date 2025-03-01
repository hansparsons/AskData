import axios from 'axios';

const OLLAMA_API_BASE_URL = 'http://127.0.0.1:11434';

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: any;
}

export interface OpenAIModel {
  name: string;
  id: string;
  provider: 'openai';
  requiresApiKey: boolean;
}

export type Model = OllamaModel | OpenAIModel;

export function isOpenAIModel(model: Model): model is OpenAIModel {
  return 'provider' in model && model.provider === 'openai';
}

export class ModelService {
  // Use static variable to persist API key across all instances
  private static openaiApiKey: string | null = null;

  setOpenAIApiKey(apiKey: string) {
    ModelService.openaiApiKey = apiKey;
  }

  getOpenAIApiKey(): string | null {
    return ModelService.openaiApiKey;
  }

  /**
   * Fetches the list of available models from Ollama and adds OpenAI models
   */
  async getAvailableModels(): Promise<Model[]> {
    try {
      const response = await axios.get(`${OLLAMA_API_BASE_URL}/api/tags`, {
        timeout: 5000 // 5 seconds timeout
      });
      
      if (response.status === 200 && response.data && Array.isArray(response.data.models)) {
        const ollamaModels = response.data.models;
        
        // Add OpenAI models
        const openaiModels: OpenAIModel[] = [
          {
            name: 'gpt-4o',
            id: 'gpt-4o',
            provider: 'openai',
            requiresApiKey: true
          }
        ];
        
        return [...ollamaModels, ...openaiModels];
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