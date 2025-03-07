import { DataSourceAttributes } from '../../models/DataSource';
import { DatabaseConnector } from './DatabaseConnector';
import { OracleConnector } from './oracleConnector';
import { PostgresConnector } from './postgresConnector';
import { MSSQLConnector } from './mssqlConnector';
import { MySQLConnector } from './mysqlConnector';
import { SQLiteConnector } from './sqliteConnector';

export type DatabaseType = 'oracle' | 'postgres' | 'mssql' | 'mysql' | 'sqlite';

export class DatabaseConnectorFactory {
  static createConnector(type: DatabaseType, config: DataSourceAttributes['connectionConfig']): DatabaseConnector {
    switch (type) {
      case 'oracle':
        return new OracleConnector(config);
      case 'postgres':
        return new PostgresConnector(config); 
      case 'mssql':
        return new MSSQLConnector(config);
      case 'mysql':
        return new MySQLConnector(config);
      case 'sqlite':
        return new SQLiteConnector(config);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }
}