import { DataSourceAttributes } from '../../models/DataSource';
import { DatabaseConnector } from './DatabaseConnector';
import { MySQLConnector } from './mysqlConnector';
import { PostgresConnector } from './postgresConnector';
import { MSSQLConnector } from './mssqlConnector';
import { OracleConnector } from './oracleConnector';

export type DatabaseType = 'mysql' | 'postgres' | 'mssql' | 'oracle';

export class DatabaseFactory {
  static createConnector(type: DatabaseType, config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }): DatabaseConnector {
    switch (type) {
      case 'mysql':
        return new MySQLConnector(config);
      case 'postgres':
        return new PostgresConnector(config);
      case 'mssql':
        return new MSSQLConnector(config);
      case 'oracle':
        return new OracleConnector(config);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  static getDatabaseTypes(): DatabaseType[] {
    return ['mysql', 'postgres', 'mssql', 'oracle'];
  }

  static getConnectionFields(type: DatabaseType): Array<{
    name: string;
    label: string;
    type: string;
    required: boolean;
  }> {
    const commonFields = [
      { name: 'host', label: 'Host', type: 'text', required: true },
      { name: 'port', label: 'Port', type: 'number', required: true },
      { name: 'database', label: 'Database', type: 'text', required: true },
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'password', required: true }
    ];

    switch (type) {
      case 'mysql':
        return commonFields;
      case 'postgres':
        return commonFields;
      case 'mssql':
        return [
          ...commonFields,
          { name: 'encrypt', label: 'Use Encryption', type: 'boolean', required: false }
        ];
      case 'oracle':
        return [
          ...commonFields,
          { name: 'serviceName', label: 'Service Name', type: 'text', required: true }
        ];
      default:
        return commonFields;
    }
  }
}