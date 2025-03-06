import { Sequelize } from 'sequelize';

// Create a temporary connection without specifying a database
const tempSequelize = new Sequelize('', 'root', 'password', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false
});

// Initialize the main sequelize instance
export const sequelize = new Sequelize('dataask', 'root', 'password', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false, // Disable logging SQL queries in production
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  retry: {
    max: 3,
    backoffJitter: 1000,
    match: [
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /SequelizeAccessDeniedError/
    ]
  }
});

// Initialize database connection
export const initDatabase = async () => {
  try {
    // First, create the database if it doesn't exist using the temporary connection
    try {
      await tempSequelize.query('CREATE DATABASE IF NOT EXISTS dataask;');
      console.log('Database created or already exists.');
    } catch (dbError) {
      console.error('Error creating database:', dbError);
      throw new Error('Failed to create database');
    } finally {
      await tempSequelize.close();
    }

    // Now try to connect to the database
    try {
      await sequelize.authenticate();
      console.log('Database connection established successfully.');
    } catch (authError) {
      console.error('Unable to connect to the database:', authError);
      throw new Error('Failed to connect to database');
    }
    
    // Import models to ensure they're registered with Sequelize
    const DataSource = require('./models/DataSource').default;
    
    // Sync the DataSource model to ensure the table exists
    try {
      await DataSource.sync({ alter: true }); // Using alter:true to preserve existing data while ensuring correct structure
      console.log('DataSource model synchronized successfully.');
    } catch (syncError) {
      console.error('Error syncing DataSource model:', syncError);
      throw new Error('Failed to create DataSource table: ' + (syncError instanceof Error ? syncError.message : 'Unknown error'));
    }
    
    // Sync all other models
    await sequelize.sync();
    console.log('All database models synchronized successfully.');
  } catch (error) {
    console.error('Database initialization failed:', error);
    if (error instanceof Error) {
      if (error.message.includes('Access denied')) {
        console.error('Please check your database credentials and ensure the user has proper permissions.');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error('Database server is not running. Please start your MySQL server.');
      }
    }
    // Instead of exiting, we'll let the application continue but in a degraded state
    console.warn('Application starting in degraded state - some features may be unavailable.');
  }
};