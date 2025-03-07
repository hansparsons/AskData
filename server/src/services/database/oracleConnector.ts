import oracledb from 'oracledb';
import { DataSourceAttributes } from '../../models/DataSource';
import { DatabaseConnector } from './DatabaseConnector';  // Fixed import path

export class OracleConnector implements DatabaseConnector {
  private connection: oracledb.Connection | null = null;
  private config: DataSourceAttributes['connectionConfig'];

  constructor(config: DataSourceAttributes['connectionConfig']) {
    if (!config) throw new Error('Oracle configuration is required');
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config || !('username' in this.config) || !('password' in this.config) ||
          !('host' in this.config) || !('port' in this.config) || !('database' in this.config)) {
        throw new Error('Missing required connection configuration');
      }

      this.connection = await oracledb.getConnection({
        user: this.config.username,
        password: this.config.password,
        connectString: `${this.config.host}:${this.config.port}/${this.config.database}`
      });
    } catch (error: unknown) {
      throw new Error(`Failed to connect to Oracle database: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close();
        this.connection = null;
      } catch (error: unknown) {
        throw new Error(`Failed to disconnect from Oracle database: ${(error as Error).message}`);
      }
    }
  }

  async executeQuery(query: string): Promise<any[]> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    try {
      const result = await this.connection.execute(query, [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows || [];
    } catch (error: unknown) {
      throw new Error(`Failed to execute query: ${(error as Error).message}`);
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    try {
      const result = await this.connection.execute(
        `SELECT table_name 
         FROM user_tables 
         ORDER BY table_name`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      return (result.rows || []).map((table: any) => table.TABLE_NAME);
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
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    try {
      const result = await this.connection.execute(
        `SELECT table_name 
         FROM user_tables 
         ORDER BY table_name`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const schema = [];

      for (const table of result.rows || []) {
        // Type assertion for the table object
        const tableName = (table as { TABLE_NAME: string }).TABLE_NAME;
        
        const columns = await this.connection.execute(
          `SELECT column_name, data_type, nullable 
           FROM user_tab_columns 
           WHERE table_name = :tableName 
           ORDER BY column_id`,
          [tableName],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        schema.push({
          tableName: tableName,
          columns: (columns.rows || []).map(column => ({
            name: (column as any).COLUMN_NAME,
            type: (column as any).DATA_TYPE,
            nullable: (column as any).NULLABLE === 'Y'
          }))
        });
      }

      return schema;
    } catch (error: unknown) {
      throw new Error(`Failed to fetch schema: ${(error as Error).message}`);
    }
  }
}