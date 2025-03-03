import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { initDatabase } from './db';
import DataSource from './models/DataSource';
import path from 'path';
import fs from 'fs/promises';
import { DocumentService } from './services/documentService';
import { OllamaService } from './services/ollamaService';
import { OpenAIService } from './services/openaiService';
import { ModelService } from './services/modelService';
import { ExportService } from './services/exportService';

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

// Initialize database
// We'll make the server start only after database initialization is complete
const startServer = async () => {
  await initDatabase();
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileType = path.extname(req.file.originalname).slice(1).toLowerCase();
    const documentService = new DocumentService();

    try {
      const processedData = await documentService.processFile(
        req.file.path,
        path.parse(req.file.originalname).name,
        fileType
      );

      res.json({
        message: 'File processed successfully',
        filename: req.file.filename,
        schema: processedData.schema
      });
    } catch (error) {
      // Clean up uploaded file if processing fails
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting failed upload:', unlinkError);
      }
      throw error;
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error processing file upload'
    });
  }
});

// External database connection endpoint
app.post('/api/connect-database', async (req: Request, res: Response) => {
  try {
    const { host, port, database, username, password } = req.body;

    // TODO: 
    // - Test connection to external database
    // - Extract schema information
    // - Store schema in main database

    res.json({ message: 'Database connected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error connecting to external database' });
  }
});

// Query endpoint
app.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { question, selectedSources, selectedModel, execute } = req.body;
    
    if (!question || !Array.isArray(selectedSources) || selectedSources.length === 0) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const documentService = new DocumentService(selectedModel);
    
    // If execute is not true, only generate SQL without executing
    if (!execute) {
      try {
        // For the first step, we'll just execute the query but only return the SQL
        // This avoids accessing private methods while still getting the SQL
        const result = await documentService.executeQuery(question, selectedSources);
        
        // Return only the SQL without the results
        return res.json({
          sql: result.sql
        });
      } catch (error) {
        console.error('SQL generation error:', error);
        return res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to generate SQL query. Please try again.'
        });
      }
    }
    
    // If execute is true, perform the full query execution and return all results
    const result = await documentService.executeQuery(question, selectedSources);

    res.json({
      sql: result.sql,
      results: result.results,
      answer: result.answer
    });
  } catch (error) {
    console.error('Query processing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process your query. Please try again.'
    });
  }
});

// Chart data generation endpoint
app.post('/api/chart-data', async (req: Request, res: Response) => {
  try {
    const { question, data, chartType, selectedModel } = req.body;
    
    if (!question || !data || !chartType) {
      return res.status(400).json({ error: 'Missing required parameters: question, data, or chartType' });
    }

    // Use DocumentService to handle both Ollama and OpenAI models
    const documentService = new DocumentService(selectedModel);
    let chartData;
    
    if (selectedModel === 'gpt-4o') {
      // For OpenAI models, we need to check if the API key is set
      const modelService = new ModelService();
      const apiKey = modelService.getOpenAIApiKey();
      
      if (!apiKey) {
        return res.status(400).json({ error: 'OpenAI API key is required for using gpt-4o model' });
      }
      
      const openaiService = new OpenAIService(apiKey, selectedModel);
      chartData = await openaiService.generateChartData(question, data, chartType);
    } else {
      // For Ollama models
      const ollamaService = new OllamaService(selectedModel);
      chartData = await ollamaService.generateChartData(question, data, chartType);
    }

    res.json(chartData);
  } catch (error) {
    console.error('Chart data generation error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to generate chart data. Please try again.'
    });
  }
});

// Get all data sources endpoint
app.get('/api/data-sources', async (req: Request, res: Response) => {
  try {
    const dataSources = await DataSource.findAll({
      attributes: ['id', 'name', 'type', 'schema'],
      order: [['createdAt', 'DESC']]
    });
    res.json({ dataSources });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch data sources. Please try again.'
    });
  }
});

// Get available LLM models endpoint
app.get('/api/models', async (req: Request, res: Response) => {
  try {
    const modelService = new ModelService();
    const models = await modelService.getAvailableModels();
    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch available models. Please try again.'
    });
  }
});

// Set OpenAI API key endpoint
app.post('/api/set-openai-key', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    
    // Create a document service instance to set the API key
    const documentService = new DocumentService();
    documentService.setOpenAIApiKey(apiKey);
    
    res.json({ success: true, message: 'OpenAI API key set successfully' });
  } catch (error) {
    console.error('Error setting OpenAI API key:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to set OpenAI API key. Please try again.'
    });
  }
});

// Export data endpoint
app.post('/api/export', async (req: Request, res: Response) => {
  try {
    const { components, formats, data } = req.body;
    
    if (!components || !formats || !data) {
      return res.status(400).json({ error: 'Missing required export parameters' });
    }
    
    const exportOptions = {
      components,
      formats
    };
    
    const exportData = {
      answer: data.answer || '',
      sqlQuery: data.sqlQuery || '',
      results: data.results || []
    };
    
    const exportService = new ExportService();
    const exportBuffer = await exportService.exportData(exportOptions, exportData);
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=export.zip');
    res.send(exportBuffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to export data. Please try again.'
    });
  }
});

// Port configuration can be set via command line arguments
if (process.argv.includes('--port')) {
  const cmdLinePort = parseInt(process.argv[process.argv.indexOf('--port') + 1], 10);
  if (!isNaN(cmdLinePort)) {
    process.env.PORT = cmdLinePort.toString();
  }
}