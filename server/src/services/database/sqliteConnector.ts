import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { DatabaseConnector } from './DatabaseConnector';
import { DataSourceAttributes } from '../../models/DataSource';

interface SQLiteColumn {
  name: string;
  type: string;
  notnull: number;
}

export class SQLiteConnector implements DatabaseConnector {
  private db: Database | null = null;
  private config: DataSourceAttributes['connectionConfig'];

  constructor(config: DataSourceAttributes['connectionConfig']) {
    if (!config) throw new Error('SQLite configuration is required');
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config || !('database' in this.config)) {
        throw new Error('Missing required connection configuration');
      }

      this.db = await open({
        filename: this.config.database,
        driver: sqlite3.Database
      });
    } catch (error: unknown) {
      throw new Error(`Failed to connect to SQLite database: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      try {
        await this.db.close();
        this.db = null;
      } catch (error: unknown) {
        throw new Error(`Failed to disconnect from SQLite database: ${(error as Error).message}`);
      }
    }
  }

  async executeQuery(query: string): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database connection not established');
    }

    try {
      return await this.db.all(query);
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
    if (!this.db) {
      throw new Error('Database connection not established');
    }

    try {
      const tables = await this.db.all<Array<{ name: string }>>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );

      const schema = [];

      for (const table of tables) {
        const tableInfo = await this.db.all<Array<SQLiteColumn>>(
          `PRAGMA table_info('${table.name}')`
        );

        schema.push({
          tableName: table.name,
          columns: tableInfo.map((column: SQLiteColumn) => ({
            name: column.name,
            type: column.type,
            nullable: column.notnull === 0
          }))
        });
      }

      return schema;
    } catch (error: unknown) {
      throw new Error(`Failed to fetch schema: ${(error as Error).message}`);
    }
  }
}