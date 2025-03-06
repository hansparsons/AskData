import { ConnectionPool, IResult } from 'mssql';
import { DataSourceAttributes } from '../../models/DataSource';
import { DatabaseConnector } from './mysqlConnector';

export class MSSQLConnector implements DatabaseConnector {
  private pool: ConnectionPool | null = null;
  private config: DataSourceAttributes['connectionConfig'];

  constructor(config: DataSourceAttributes['connectionConfig']) {
    if (!config) throw new Error('SQL Server configuration is required');
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config || !('username' in this.config) || !('password' in this.config) ||
          !('host' in this.config) || !('port' in this.config) || !('database' in this.config)) {
        throw new Error('Missing required connection configuration');
      }

      this.pool = await new ConnectionPool({
        server: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        options: {
          encrypt: true,
          trustServerCertificate: true
        }
      }).connect();
    } catch (error: unknown) {
      throw new Error(`Failed to connect to SQL Server database: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
        this.pool = null;
      } catch (error: unknown) {
        throw new Error(`Failed to disconnect from SQL Server database: ${(error as Error).message}`);
      }
    }
  }

  async executeQuery(query: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database connection not established');
    }

    try {
      const result: IResult<any> = await this.pool.request().query(query);
      return result.recordset;
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
      const tables = await this.pool.request().query(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_TYPE = 'BASE TABLE'`
      );

      const schema = [];

      for (const table of tables.recordset) {
        const columns = await this.pool.request().query(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE 
           FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = '${table.TABLE_NAME}'`
        );

        schema.push({
          tableName: table.TABLE_NAME,
          columns: columns.recordset.map((column: any) => ({
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