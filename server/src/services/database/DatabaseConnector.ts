export interface DatabaseConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  executeQuery(query: string): Promise<any[]>;
  getSchema(): Promise<{
    tableName: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  }[]>;
}