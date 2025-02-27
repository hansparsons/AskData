import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import { initDatabase } from './db';
import DataSource from './models/DataSource';
import path from 'path';
import fs from 'fs/promises';
import { DocumentService } from './services/documentService';

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
    const { question, selectedSources } = req.body;
    
    if (!question || !Array.isArray(selectedSources) || selectedSources.length === 0) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    const documentService = new DocumentService();
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

// Port configuration can be set via command line arguments
if (process.argv.includes('--port')) {
  const cmdLinePort = parseInt(process.argv[process.argv.indexOf('--port') + 1], 10);
  if (!isNaN(cmdLinePort)) {
    process.env.PORT = cmdLinePort.toString();
  }
}