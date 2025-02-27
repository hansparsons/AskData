import { readFile } from 'fs/promises';
import * as xlsx from 'xlsx';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { DataTypes } from 'sequelize';
import { sequelize } from '../db';
import DataSource from '../models/DataSource';

interface TableSchema {
  tableName: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}

export interface ProcessedData {
  schema: TableSchema;
  data: any[];
}

export async function processSpreadsheet(filePath: string, fileName: string): Promise<ProcessedData> {
  try {
    const fileBuffer = await readFile(filePath);
    const workbook = xlsx.read(fileBuffer);
    
    if (!workbook.SheetNames.length) {
      throw new Error('No sheets found in the spreadsheet');
    }
    
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      throw new Error('Failed to read sheet from spreadsheet');
    }
    
    // Convert sheet to JSON
    const data = xlsx.utils.sheet_to_json(sheet);
    
    if (data.length === 0) {
      throw new Error('Spreadsheet is empty');
    }
    
    // Infer schema from the first row
    const firstRow = data[0] as Record<string, unknown>;
    const columns = Object.keys(firstRow).map(key => ({
      name: key,
      type: inferColumnType(data, key),
      nullable: true
    }));
    
    if (columns.length === 0) {
      throw new Error('No columns found in spreadsheet');
    }
    
    return {
      schema: {
        tableName: fileName.replace(/^\d+-/, '').replace(/\.[^/.]+$/, ''),
        columns
      },
      data
    };
  } catch (error) {
    console.error('Error processing spreadsheet:', error);
    throw error instanceof Error ? error : new Error('Failed to process spreadsheet');
  }
}

export async function processDocument(filePath: string, fileName: string, type: 'document' | 'pdf'): Promise<ProcessedData> {
  try {
    let text: string;
    
    if (type === 'document') {
      const result = await mammoth.extractRawText({ path: filePath });
      if (!result || !result.value) {
        throw new Error('Failed to extract text from document');
      }
      text = result.value;
    } else {
      const dataBuffer = await readFile(filePath);
      const pdf = await pdfParse(dataBuffer);
      if (!pdf || !pdf.text) {
        throw new Error('Failed to extract text from PDF');
      }
      text = pdf.text;
    }
    
    if (!text.trim()) {
      throw new Error('Document is empty');
    }
    
    // Create a simple schema for document content
    const schema: TableSchema = {
      tableName: fileName.replace(/\.[^/.]+$/, ''),
      columns: [
        { name: 'content', type: 'TEXT', nullable: false },
        { name: 'position', type: 'INTEGER', nullable: false }
      ]
    };
    
    // Split text into paragraphs and create rows
    const paragraphs = text.split(/\n\s*\n/);
    const data = paragraphs
      .map((content, index) => ({
        content: content.trim(),
        position: index
      }))
      .filter(row => row.content); // Remove empty paragraphs
    
    if (data.length === 0) {
      throw new Error('No valid content found in document');
    }
    
    return { schema, data };
  } catch (error) {
    console.error('Error processing document:', error);
    throw error instanceof Error ? error : new Error('Failed to process document');
  }
}

export async function storeProcessedData(processedData: ProcessedData, sourceType: 'spreadsheet' | 'document' | 'database'): Promise<void> {
  const { schema, data } = processedData;
  
  try {
    // Validate input data
    if (!schema || !schema.columns || !Array.isArray(data)) {
      throw new Error('Invalid processed data format');
    }

    // Sanitize table name: remove timestamp, file extension and special characters, replace spaces with underscores
    const sanitizedTableName = schema.tableName
      .replace(/^\d{13}-/, '') // remove timestamp prefix
      .replace(/\.[^/.]+$/, '') // remove file extension
      .replace(/[^a-zA-Z0-9_]/g, '_') // replace special chars with underscore
      .replace(/^[0-9]/, 't$&') // prepend 't' if starts with number
      .toLowerCase(); // convert to lowercase for consistency
    
    // Create the table dynamically
    const tableDefinition: { [key: string]: any } = {};
    schema.columns.forEach(column => {
      if (!column.name || !column.type) {
        throw new Error('Invalid column definition');
      }
      tableDefinition[column.name] = {
        type: mapToSequelizeType(column.type),
        allowNull: column.nullable
      };
    });
    
    // Define the model dynamically
    const DynamicModel = sequelize.define(sanitizedTableName, tableDefinition, {
      tableName: sanitizedTableName,
      timestamps: false
    });
    
    // Sync the model with database
    await DynamicModel.sync();
    
    // Insert the data
    await DynamicModel.bulkCreate(data);
    
    // Store the schema information in DataSource model
    await DataSource.create({
      createdAt: new Date(),
      updatedAt: new Date(),
      name: sanitizedTableName,
      type: sourceType,
      schema: [{ ...schema, tableName: sanitizedTableName }]
    });
  } catch (error) {
    console.error('Error storing processed data:', error);
    throw error instanceof Error ? error : new Error('Failed to store processed data');
  }
}

function inferColumnType(data: any[], key: string): string {
  try {
    for (const row of data) {
      const value = row[key];
      if (value != null) {
        if (typeof value === 'number') {
          return Number.isInteger(value) ? 'INTEGER' : 'FLOAT';
        } else if (typeof value === 'boolean') {
          return 'BOOLEAN';
        } else if (value instanceof Date) {
          return 'DATETIME';
        }
      }
    }
    return 'TEXT';
  } catch (error) {
    console.error('Error inferring column type:', error);
    return 'TEXT'; // Default to TEXT type if inference fails
  }
}

function mapToSequelizeType(type: string): any {
  try {
    switch (type) {
      case 'INTEGER':
        return DataTypes.INTEGER;
      case 'FLOAT':
        return DataTypes.FLOAT;
      case 'BOOLEAN':
        return DataTypes.BOOLEAN;
      case 'DATETIME':
        return DataTypes.DATE;
      case 'TEXT':
      default:
        return DataTypes.TEXT;
    }
  } catch (error) {
    console.error('Error mapping to Sequelize type:', error);
    return DataTypes.TEXT; // Default to TEXT type if mapping fails
  }
}