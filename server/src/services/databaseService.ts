import { DataSourceAttributes } from '../models/DataSource';
import { DatabaseFactory, DatabaseType } from './database/databaseFactory';
import { DatabaseConnector } from './database/DatabaseConnector';
import DataSource from '../models/DataSource';

export class DatabaseService {
  private static instance: DatabaseService;
  private connectors: Map<number, DatabaseConnector> = new Map();

  private constructor() {}

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  async addDataSource(name: string, type: DatabaseType, config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }): Promise<DataSource> {
    try {
      // Create and test the connection
      const connector = DatabaseFactory.createConnector(type, config);
      await connector.connect();

      // Get the schema
      const schema = await connector.getSchema();

      // Create the data source record
      const dataSource = await DataSource.create({
        name,
        type: 'database',
        connectionConfig: {
          host: config.host,
          port: config.port,
          database: config.database,
          username: config.username,
          password: config.password,
          databaseType: type
        },
        schema,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Store the connector
      this.connectors.set(dataSource.id, connector);

      return dataSource;
    } catch (error: unknown) {
      throw new Error(`Failed to add data source: ${(error as Error).message}`);
    }
  }

  async executeQuery(dataSourceId: number, query: string): Promise<any[]> {
    const connector = this.connectors.get(dataSourceId);
    if (!connector) {
      const dataSource = await DataSource.findByPk(dataSourceId);
      if (!dataSource || !dataSource.connectionConfig) {
        throw new Error('Data source not found');
      }

      const newConnector = DatabaseFactory.createConnector(
        dataSource.connectionConfig.databaseType as DatabaseType,
        dataSource.connectionConfig
      );
      await newConnector.connect();
      this.connectors.set(dataSourceId, newConnector);
      return newConnector.executeQuery(query);
    }

    return connector.executeQuery(query);
  }

  async getSchema(dataSourceId: number): Promise<DataSourceAttributes['schema']> {
    const dataSource = await DataSource.findByPk(dataSourceId);
    if (!dataSource) {
      throw new Error('Data source not found');
    }
    return dataSource.schema;
  }

  async removeDataSource(dataSourceId: number): Promise<void> {
    const connector = this.connectors.get(dataSourceId);
    if (connector) {
      await connector.disconnect();
      this.connectors.delete(dataSourceId);
    }

    const dataSource = await DataSource.findByPk(dataSourceId);
    if (dataSource) {
      await dataSource.destroy();
    }
  }

  async getSupportedDatabases(): Promise<Array<{
    type: DatabaseType;
    fields: Array<{
      name: string;
      label: string;
      type: string;
      required: boolean;
    }>;
  }>> {
    const types = DatabaseFactory.getDatabaseTypes();
    return types.map(type => ({
      type,
      fields: DatabaseFactory.getConnectionFields(type)
    }));
  }
}