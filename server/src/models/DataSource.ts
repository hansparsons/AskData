import { Model, DataTypes } from 'sequelize';
import { sequelize } from '../db';

export interface DataSourceAttributes {
  id?: number;
  name: string;
  type: 'spreadsheet' | 'document' | 'database';
  filePath?: string;
  connectionConfig?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    databaseType?: string;
  };
  schema: {
    tableName: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

class DataSource extends Model<DataSourceAttributes> implements DataSourceAttributes {
  public id!: number;
  public name!: string;
  public type!: 'spreadsheet' | 'document' | 'database';
  public filePath?: string;
  public connectionConfig?: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    databaseType?: string;
  };
  public schema!: {
    tableName: string;
    columns: Array<{
      name: string;
      type: string;
      nullable: boolean;
    }>;
  }[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

DataSource.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('spreadsheet', 'document', 'database'),
      allowNull: false,
    },
    filePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    connectionConfig: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    schema: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'DataSource',
    tableName: 'data_sources',
  }
);

export default DataSource;