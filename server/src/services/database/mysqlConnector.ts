import mysql from 'mysql2/promise';
import { DataSourceAttributes } from '../../models/DataSource';
import { DatabaseConnector } from './DatabaseConnector';

export class MySQLConnector implements DatabaseConnector {
  private connection: mysql.Connection | null = null;
  private config: DataSourceAttributes['connectionConfig'];

  constructor(config: DataSourceAttributes['connectionConfig']) {
    if (!config) throw new Error('MySQL configuration is required');
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config || !('username' in this.config) || !('password' in this.config) ||
          !('host' in this.config) || !('port' in this.config) || !('database' in this.config)) {
        throw new Error('Missing required connection configuration');
      }

      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password
      });
    } catch (error: unknown) {
      throw new Error(`Failed to connect to MySQL database: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        this.connection = null;
      } catch (error: unknown) {
        throw new Error(`Failed to disconnect from MySQL database: ${(error as Error).message}`);
      }
    }
  }

  async executeQuery(query: string): Promise<any[]> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    try {
      const [rows] = await this.connection.query(query);
      return rows as any[];
    } catch (error: unknown) {
      throw new Error(`Failed to execute query: ${(error as Error).message}`);
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.connection || !this.config || !this.config.database) {
      throw new Error('Database connection not established or invalid configuration');
    }

    try {
      const [tables] = await this.connection.query(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ?`,
        [this.config.database]
      );
      
      return (tables as any[]).map(table => table.TABLE_NAME);
    } catch (error: unknown) {
      throw new Error(`Failed to fetch tables: ${(error as Error).message}`);
    }
  }

  async getSchema(): Promise<{
    tableName: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  }[]> {
    if (!this.connection || !this.config || !this.config.database) {
      throw new Error('Database connection not established or invalid configuration');
    }

    try {
      const [tables] = await this.connection.query(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ?`,
        [this.config.database]
      );

      const schema = [];

      for (const table of tables as any[]) {
        const [columns] = await this.connection.query(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [this.config.database, table.TABLE_NAME]
        );

        schema.push({
          tableName: table.TABLE_NAME,
          columns: (columns as any[]).map(column => ({
            name: column.COLUMN_NAME,
            type: column.DATA_TYPE,
            nullable: column.IS_NULLABLE === 'YES'
          }))
        });
      }

      return schema;
    } catch (error: unknown) {
      throw new Error(`Failed to fetch schema: ${(error as Error).message}`);
    }
  }
}