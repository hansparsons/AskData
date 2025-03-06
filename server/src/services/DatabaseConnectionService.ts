import DataSource from '../models/DataSource';
import { DatabaseConnectorFactory, DatabaseType } from './database/DatabaseConnectorFactory';
import { DatabaseConnector } from './database/DatabaseConnector';

export interface DatabaseConnectionConfig {
  name: string;
  type: DatabaseType;
  host?: string;
  port?: number;
  database: string;
  username?: string;
  password?: string;
}

export class DatabaseConnectionService {
  async testConnection(config: DatabaseConnectionConfig): Promise<boolean> {
    const connector = DatabaseConnectorFactory.createConnector(config.type, {
      host: config.host || '',
      port: config.port || 0,
      database: config.database,
      username: config.username || '',
      password: config.password || '',
      databaseType: config.type
    });

    try {
      await connector.connect();
      await connector.disconnect();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async saveConnection(config: DatabaseConnectionConfig): Promise<DataSource> {
    try {
      // Test the connection first
      const isValid = await this.testConnection(config);
      if (!isValid) {
        throw new Error('Failed to connect to the database with the provided configuration');
      }

      // Get current timestamp
      const now = new Date();

      // Save to database
      const dataSource = await DataSource.create({
        name: config.name,
        type: 'database',
        schema: [], // Add empty schema initially
        connectionConfig: {
          host: config.host || '',
          port: config.port || 0,
          database: config.database,
          username: config.username || '',
          password: config.password || '',
          databaseType: config.type
        },
        createdAt: now,
        updatedAt: now
      });

      return dataSource;
    } catch (error: unknown) {
      throw new Error(`Failed to save database connection: ${(error as Error).message}`);
    }
  }

  async getConnections(): Promise<DataSource[]> {
    return await DataSource.findAll({
      where: {
        type: 'database'
      }
    });
  }

  async getConnection(id: number): Promise<DataSource | null> {
    return await DataSource.findOne({
      where: {
        id,
        type: 'database'
      }
    });
  }

  async deleteConnection(id: number): Promise<boolean> {
    const deleted = await DataSource.destroy({
      where: {
        id,
        type: 'database'
      }
    });
    return deleted > 0;
  }

  async updateConnection(id: number, config: DatabaseConnectionConfig): Promise<DataSource | null> {
    try {
      // Test the connection first
      const isValid = await this.testConnection(config);
      if (!isValid) {
        throw new Error('Failed to connect to the database with the provided configuration');
      }

      const [updated] = await DataSource.update({
        name: config.name,
        connectionConfig: {
          host: config.host || '',
          port: config.port || 0,
          database: config.database,
          username: config.username || '',
          password: config.password || '',
          databaseType: config.type
        }
      }, {
        where: {
          id,
          type: 'database'
        }
      });

      if (updated > 0) {
        return await this.getConnection(id);
      }
      return null;
    } catch (error: unknown) {
      throw new Error(`Failed to update database connection: ${(error as Error).message}`);
    }
  }
}