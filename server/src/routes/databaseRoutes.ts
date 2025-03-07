import express, { Request, Response } from 'express';
import { DatabaseConnectionService } from '../services/DatabaseConnectionService';
import { DatabaseConnectorFactory, DatabaseType } from '../services/database/DatabaseConnectorFactory';
import DataSource from '../models/DataSource';
import { DatabaseConnector } from '../services/database/DatabaseConnector';

const router = express.Router();
const databaseService = new DatabaseConnectionService();

// Test database connection and fetch tables
router.post('/test', async (req, res) => {
  try {
    const connector = DatabaseConnectorFactory.createConnector(req.body.type, {
      host: req.body.host || '',
      port: req.body.port || 0,
      database: req.body.database,
      username: req.body.username || '',
      password: req.body.password || '',
      databaseType: req.body.type
    });

    await connector.connect();
    const tables = await connector.getTables();
    await connector.disconnect();

    res.json({ success: true, tables });
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
    console.log('[DEBUG] Received database connection request with body:', {
      ...req.body,
      password: '***' // Mask password for security
    });
    console.log('[DEBUG] Schema data received:', req.body.schema);

    const dataSource = await databaseService.saveConnection(req.body);
    console.log('[DEBUG] Database connection saved successfully:', {
      id: dataSource.id,
      name: dataSource.name,
      type: dataSource.connectionConfig?.databaseType
    });

    res.json({ 
      success: true, 
      dataSource 
    });
  } catch (error) {
    console.error('[DEBUG] Error saving database connection:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get tables for a specific connection
router.get('/tables/:id', async (req: Request, res: Response) => {
  try {
    const dataSourceId = parseInt(req.params.id);
    if (isNaN(dataSourceId)) {
      return res.status(400).json({ success: false, error: 'Invalid data source ID' });
    }
    
    const dataSource = await DataSource.findByPk(dataSourceId);
    if (!dataSource || !dataSource.connectionConfig) {
      return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    
    const connector = DatabaseConnectorFactory.createConnector(
      dataSource.connectionConfig.databaseType as DatabaseType,
      dataSource.connectionConfig
    );
    
    await connector.connect();
    const tables = await connector.getTables();
    await connector.disconnect();
    
    res.json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Get schemas for selected tables
router.post('/schemas', async (req, res) => {
  try {
    const { type, host, port, database, username, password, connectString, encrypt, serviceName, tables } = req.body;
    
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      return res.status(400).json({ success: false, error: 'No tables specified' });
    }
    
    const connector = DatabaseConnectorFactory.createConnector(type, {
      host: host || '',
      port: port || 0,
      database,
      username: username || '',
      password: password || '',
      databaseType: type,
      connectString,
      encrypt,
      serviceName
    });
    
    await connector.connect();
    
    // Get schema for each table
    const schemas: Record<string, any> = {};
    const allSchemas = await connector.getSchema();
    
    // Filter schemas for selected tables
    for (const schema of allSchemas) {
      if (tables.includes(schema.tableName)) {
        schemas[schema.tableName] = schema;
      }
    }
    
    await connector.disconnect();
    
    res.json({ success: true, schemas });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;