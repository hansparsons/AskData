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

function sanitizeColumnName(columnName: string): string {
  return columnName
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/[\s#\-]/g, '_') // Replace spaces, hashtags, and hyphens with underscores
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove any other special characters
    .replace(/_+/g, '_') // Replace multiple underscores with a single one
    .replace(/_$/g, '') // Remove trailing underscores
    .replace(/^(\d)/, 'col_$1') // Prefix with 'col_' if starts with number
    .toLowerCase(); // Convert to lowercase for consistency
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
    
    // Infer schema from the first row and sanitize column names
    const firstRow = data[0] as Record<string, unknown>;
    const columns = Object.keys(firstRow).map(key => ({
      name: sanitizeColumnName(key.toLowerCase()), // Ensure consistent casing before sanitization
      type: inferColumnType(data, key),
      nullable: true
    }));
    
    if (columns.length === 0) {
      throw new Error('No columns found in spreadsheet');
    }
    
    // Create a mapping of original column names to sanitized column names
    const columnMapping: Record<string, string> = {};
    Object.keys(firstRow).forEach(key => {
      columnMapping[key] = sanitizeColumnName(key.toLowerCase()); // Ensure consistent casing before sanitization
    });
    
    // Update data with sanitized column names
    const sanitizedData = data.map(row => {
      const sanitizedRow: Record<string, unknown> = {};
      Object.entries(row as Record<string, unknown>).forEach(([key, value]) => {
        const sanitizedKey = columnMapping[key] || sanitizeColumnName(key.toLowerCase()); // Handle any unmapped columns
        sanitizedRow[sanitizedKey] = value;
      });
      return sanitizedRow;
    });
    
    return {
      schema: {
        tableName: fileName.replace(/^\d+-/, '').replace(/\.[^/.]+$/, ''),
        columns
      },
      data: sanitizedData
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
    // Verify database connection before proceeding
    try {
      await sequelize.authenticate();
      console.log('Database connection verified before storing data');
    } catch (dbError) {
      console.error('Database connection error before storing data:', dbError);
      throw new Error('Database connection failed. Please ensure your database is running.');
    }
    
    // Ensure DataSource model is synced before proceeding
    try {
      await DataSource.sync({ alter: true });
      console.log('DataSource model synchronized before storing data');
    } catch (syncError) {
      console.error('Error syncing DataSource model:', syncError);
      throw new Error('Failed to prepare database for storing data');
    }

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
    // Check for mixed data types
    let hasString = false;
    let hasNumber = false;
    let hasBoolean = false;
    let hasDate = false;
    
    // First pass: check for any non-numeric strings
    for (const row of data) {
      const value = row[key];
      if (value != null) {
        if (typeof value === 'string' && value.trim() !== '') {
          // Consider any string containing letters as TEXT type
          if (value.trim().match(/[A-Za-z]/)) {
            hasString = true;
            break; // Exit early since we found a string
          }
          // Only consider as number if it's purely numeric
          if (!isNaN(Number(value)) && value.trim().match(/^-?\d*\.?\d+$/)) {
            hasNumber = true;
          } else {
            hasString = true;
            break;
          }
        } else if (typeof value === 'number') {
          hasNumber = true;
        } else if (typeof value === 'boolean') {
          hasBoolean = true;
        } else if (value instanceof Date) {
          hasDate = true;
        }
      }
    }
    
    // Priority: String > Date > Boolean > Number
    if (hasString) {
      return 'TEXT';
    } else if (hasDate) {
      return 'DATETIME';
    } else if (hasBoolean) {
      return 'BOOLEAN';
    } else if (hasNumber) {
      // Only if all numeric values, check if they're all integers
      let allIntegers = true;
      for (const row of data) {
        const value = row[key];
        if (value != null) {
          const numValue = typeof value === 'string' ? Number(value) : value;
          if (typeof numValue === 'number' && !Number.isInteger(numValue)) {
            allIntegers = false;
            break;
          }
        }
      }
      return allIntegers ? 'INTEGER' : 'FLOAT';
    }
    
    // Default to TEXT for empty or null values
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