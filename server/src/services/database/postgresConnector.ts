import { Pool, QueryResult } from 'pg';
import { DataSourceAttributes } from '../../models/DataSource';
import { DatabaseConnector } from './DatabaseConnector';

export class PostgresConnector implements DatabaseConnector {
  private pool: Pool | null = null;
  private config: DataSourceAttributes['connectionConfig'];

  constructor(config: DataSourceAttributes['connectionConfig']) {
    if (!config) throw new Error('PostgreSQL configuration is required');
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config || !('username' in this.config) || !('password' in this.config) ||
          !('host' in this.config) || !('port' in this.config) || !('database' in this.config)) {
        throw new Error('Missing required connection configuration');
      }

      this.pool = new Pool({
        user: this.config.username,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      });

      // Test connection
      await this.pool.query('SELECT 1');
    } catch (error: unknown) {
      throw new Error(`Failed to connect to PostgreSQL database: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
      } catch (error: unknown) {
        throw new Error(`Failed to disconnect from PostgreSQL database: ${(error as Error).message}`);
      }
    }
  }

  async executeQuery(query: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database connection not established');
    }

    try {
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error: unknown) {
      throw new Error(`Failed to execute query: ${(error as Error).message}`);
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
    if (!this.pool) {
      throw new Error('Database connection not established');
    }

    try {
      const tables = await this.pool.query(
        `SELECT table_name 
         FROM information_schema.tables 
         WHERE table_schema = 'public'`
      );

      const schema = [];

      for (const table of tables.rows) {
        const columns = await this.pool.query(
          `SELECT column_name, data_type, is_nullable 
           FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = $1`,
          [table.table_name]
        );

        schema.push({
          tableName: table.table_name,
          columns: columns.rows.map((column: any) => ({
            name: column.column_name,
            type: column.data_type,
            nullable: column.is_nullable === 'YES'
          }))
        });
      }

      return schema;
    } catch (error: unknown) {
      throw new Error(`Failed to fetch schema: ${(error as Error).message}`);
    }
  }

  // Add the missing getTables method
  async getTables(): Promise<string[]> {
    // Implementation for getting tables from PostgreSQL
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    try {
      const result = await this.executeQuery(query);
      return result.map(row => row.table_name);
    } catch (error) {
      console.error('Error fetching tables from PostgreSQL:', error);
      throw error;
    }
  }
}