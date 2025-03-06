export type DatabaseType = 'mysql' | 'postgres' | 'oracle' | 'mssql' | 'sqlite';

export interface DataSource {
  id: number;
  name: string;
  connectionConfig: {
    databaseType: DatabaseType;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    [key: string]: any;
  };
}