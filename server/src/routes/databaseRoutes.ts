import express from 'express';
import { DatabaseConnectionService } from '../services/DatabaseConnectionService';
import DataSource from '../models/DataSource';

const router = express.Router();
const databaseService = new DatabaseConnectionService();

// Test database connection
router.post('/test', async (req, res) => {
  try {
    const isConnected = await databaseService.testConnection(req.body);
    res.json({ success: isConnected });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Save database connection
router.post('/connect', async (req, res) => {
  try {
    const dataSource = await databaseService.saveConnection(req.body);
    res.json({ 
      success: true, 
      dataSource 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get all connections
router.get('/', async (req, res) => {
  try {
    const connections = await databaseService.getConnections();
    res.json(connections);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Create a new database connection
router.post('/', async (req, res) => {
  try {
    const dataSource = await databaseService.saveConnection(req.body);
    res.json({ 
      success: true, 
      dataSource 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;