import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { Readable } from 'stream';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Document, Paragraph, Packer } from 'docx';

interface ExportOptions {
  components: {
    answer: boolean;
    sqlQuery: boolean;
    results: boolean;
  };
  formats: {
    answer: {
      txt: boolean;
      pdf: boolean;
      docx: boolean;
      gdoc: boolean;
    };
    sqlQuery: {
      sql: boolean;
      txt: boolean;
    };
    results: {
      xlsx: boolean;
      gsheet: boolean;
      csv: boolean;
      tsv: boolean;
      json: boolean;
    };
  };
}

interface ExportData {
  answer: string;
  sqlQuery: string;
  results: any;
}

export class ExportService {
  private async exportAnswer(answer: string, formats: ExportOptions['formats']['answer']): Promise<Map<string, Buffer>> {
    const files = new Map<string, Buffer>();

    if (formats.txt) {
      files.set('answer.txt', Buffer.from(answer, 'utf-8'));
    }

    if (formats.pdf) {
      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const pdfDoc = new PDFDocument();
        const chunks: Buffer[] = [];

        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', reject);

        pdfDoc.text(answer);
        pdfDoc.end();
      });
      files.set('answer.pdf', pdfBuffer);
    }

    if (formats.docx) {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [new Paragraph({ text: answer })]
        }]
      });
      const docxBuffer = await Packer.toBuffer(doc);
      files.set('answer.docx', docxBuffer);
    }

    return files;
  }

  private async exportSqlQuery(sqlQuery: string, formats: ExportOptions['formats']['sqlQuery']): Promise<Map<string, Buffer>> {
    const files = new Map<string, Buffer>();

    if (formats.sql) {
      files.set('query.sql', Buffer.from(sqlQuery, 'utf-8'));
    }

    if (formats.txt) {
      files.set('query.txt', Buffer.from(sqlQuery, 'utf-8'));
    }

    return files;
  }

  private async exportResults(results: any[], formats: ExportOptions['formats']['results']): Promise<Map<string, Buffer>> {
    const files = new Map<string, Buffer>();

    if (formats.json) {
      files.set('results.json', Buffer.from(JSON.stringify(results, null, 2), 'utf-8'));
    }

    // Handle CSV and TSV formats independently
    if (formats.csv) {
      const content = formatDelimitedData(results, ',');
      files.set('results.csv', Buffer.from(content, 'utf-8'));
    }

    if (formats.tsv) {
      const content = formatDelimitedData(results, '\t');
      files.set('results.tsv', Buffer.from(content, 'utf-8'));
    }

    function formatDelimitedData(data: any[], delimiter: string): string {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      
      // Properly escape and format values based on the delimiter
      const escapeValue = (value: any, delim: string): string => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        
        // For CSV, wrap in quotes if contains delimiter, newline, or quotes
        if (delim === ',' && (stringValue.includes(delim) || stringValue.includes('\n') || stringValue.includes('"'))) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        
        // For TSV, replace tabs with spaces to avoid delimiter confusion
        if (delim === '\t' && stringValue.includes(delim)) {
          return stringValue.replace(/\t/g, ' ');
        }
        
        return stringValue;
      };
      
      return [
        headers.map(h => escapeValue(h, delimiter)).join(delimiter),
        ...data.map(row => headers.map(header => escapeValue(row[header], delimiter)).join(delimiter))
      ].join('\n');
    }

    if (formats.xlsx) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Results');

      if (results.length > 0) {
        const headers = Object.keys(results[0]);
        worksheet.addRow(headers);
        results.forEach(row => {
          worksheet.addRow(headers.map(header => row[header]));
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      files.set('results.xlsx', Buffer.from(buffer));
    }

    return files;
  }

  public async exportData(options: ExportOptions, data: ExportData): Promise<Buffer> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const exportPromises: Promise<Map<string, Buffer>>[] = [];

    if (options.components.answer) {
      exportPromises.push(this.exportAnswer(data.answer, options.formats.answer));
    }

    if (options.components.sqlQuery) {
      exportPromises.push(this.exportSqlQuery(data.sqlQuery, options.formats.sqlQuery));
    }

    if (options.components.results) {
      exportPromises.push(this.exportResults(data.results, options.formats.results));
    }

    const exportedFiles = await Promise.all(exportPromises);

    exportedFiles.forEach(files => {
      files.forEach((content, filename) => {
        archive.append(content, { name: filename });
      });
    });

    archive.finalize();

    return new Promise((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });
  }
}