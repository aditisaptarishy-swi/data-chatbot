import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Dataset, TableSchema, ColumnSchema } from '@/types';
import { SQLEngine } from './sqlEngine';

export class DataProcessor {
  static async processFile(file: File): Promise<Dataset> {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    try {
      // Load data into SQL engine
      switch (fileExtension) {
        case 'csv':
          await SQLEngine.loadCSVFile(file);
          break;
        case 'xlsx':
        case 'xls':
          await SQLEngine.loadExcelFile(file);
          break;
        default:
          throw new Error(`Unsupported file format: ${fileExtension}`);
      }

      // Get schema from SQL engine
      const columns = SQLEngine.getTableSchema('dataset');
      const rowCount = SQLEngine.getRowCount('dataset');
      
      const schema: TableSchema = {
        tableName: 'dataset',
        columns: columns.map(col => ({
          name: col.name,
          type: this.mapSQLTypeToColumnType(col.type),
          nullable: true // SQLite allows nulls by default
        }))
      };

      // Get a sample of the data for display purposes
      const sampleData = SQLEngine.executeQuery('SELECT * FROM dataset LIMIT 100');
      
      return {
        id: this.generateId(),
        name: file.name,
        data: sampleData,
        schema,
        uploadedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static mapSQLTypeToColumnType(sqlType: string): ColumnSchema['type'] {
    switch (sqlType.toUpperCase()) {
      case 'INTEGER':
        return 'INTEGER';
      case 'REAL':
        return 'REAL';
      case 'TEXT':
        return 'TEXT';
      default:
        return 'TEXT';
    }
  }

  private static parseCSV(file: File): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          } else {
            resolve(results.data as Record<string, any>[]);
          }
        },
        error: (error) => reject(error)
      });
    });
  }

  private static async parseExcel(file: File): Promise<Record<string, any>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData as Record<string, any>[]);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsArrayBuffer(file);
    });
  }

  static generateSchema(data: Record<string, any>[], tableName: string): TableSchema {
    if (data.length === 0) {
      return { tableName: this.sanitizeTableName(tableName), columns: [] };
    }

    const sample = data[0];
    const columns: ColumnSchema[] = Object.keys(sample).map(key => ({
      name: key,
      type: this.inferColumnType(data, key),
      nullable: this.checkNullable(data, key)
    }));

    return {
      tableName: this.sanitizeTableName(tableName),
      columns
    };
  }

  private static inferColumnType(data: Record<string, any>[], columnName: string): ColumnSchema['type'] {
    const values = data.map(row => row[columnName]).filter(val => val !== null && val !== undefined && val !== '');
    
    if (values.length === 0) return 'TEXT';

    // Check for boolean
    if (values.every(val => typeof val === 'boolean' || val === 'true' || val === 'false' || val === 0 || val === 1)) {
      return 'BOOLEAN';
    }

    // Check for numbers
    if (values.every(val => !isNaN(Number(val)) && isFinite(Number(val)))) {
      // Check if all numbers are integers
      if (values.every(val => Number.isInteger(Number(val)))) {
        return 'INTEGER';
      }
      return 'REAL';
    }

    // Check for dates
    if (values.every(val => !isNaN(Date.parse(val)))) {
      return 'DATE';
    }

    return 'TEXT';
  }

  private static checkNullable(data: Record<string, any>[], columnName: string): boolean {
    return data.some(row => row[columnName] === null || row[columnName] === undefined || row[columnName] === '');
  }

  private static sanitizeTableName(fileName: string): string {
    return fileName
      .replace(/\.[^/.]+$/, '') // Remove file extension
      .replace(/[^a-zA-Z0-9_]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/^[0-9]/, '_$&') // Prefix with underscore if starts with number
      .toLowerCase();
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static executeQuery(data: Record<string, any>[], query: string): Record<string, any>[] {
    try {
      // Use the SQL engine for proper SQL execution
      return SQLEngine.executeQuery(query);
    } catch (error) {
      console.error('SQL Engine execution error:', error);
      // Fallback to simple query processing for backward compatibility
      return this.executeFallbackQuery(data, query);
    }
  }

  private static executeFallbackQuery(data: Record<string, any>[], query: string): Record<string, any>[] {
    // Simple fallback query execution for basic operations
    try {
      const lowerQuery = query.toLowerCase().trim();
      let result = [...data];
      
      // Handle clarification requests
      if (query === 'CLARIFICATION_NEEDED') {
        return [{ message: 'Please provide a more specific question about your data.' }];
      }
      
      // Handle SHOW COLUMNS queries
      if (lowerQuery.includes('show columns')) {
        if (data.length === 0) return [];
        const sampleRow = data[0];
        const columnInfo = Object.keys(sampleRow).map(columnName => ({
          column_name: columnName,
          data_type: this.inferDataType(data, columnName),
          sample_value: sampleRow[columnName]
        }));
        return columnInfo;
      }
      
      // For other queries, return first 10 rows as fallback
      return data.slice(0, 10);
    } catch (error) {
      console.error('Fallback query execution error:', error);
      return data.slice(0, 10);
    }
  }

  private static groupBy(data: Record<string, any>[], key: string): Record<string, Record<string, any>[]> {
    return data.reduce((groups, item) => {
      const group = item[key] || 'Unknown';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(item);
      return groups;
    }, {} as Record<string, Record<string, any>[]>);
  }

  private static inferDataType(data: Record<string, any>[], columnName: string): string {
    const values = data.map(row => row[columnName]).filter(val => val !== null && val !== undefined && val !== '');
    
    if (values.length === 0) return 'TEXT';

    // Check for boolean
    if (values.every(val => typeof val === 'boolean' || val === 'true' || val === 'false' || val === 0 || val === 1)) {
      return 'BOOLEAN';
    }

    // Check for numbers
    if (values.every(val => !isNaN(Number(val)) && isFinite(Number(val)))) {
      // Check if all numbers are integers
      if (values.every(val => Number.isInteger(Number(val)))) {
        return 'INTEGER';
      }
      return 'REAL';
    }

    // Check for dates
    if (values.every(val => !isNaN(Date.parse(val)))) {
      return 'DATE';
    }

    return 'TEXT';
  }
}

export const cacheSchema = (schema: TableSchema): void => {
  try {
    const cached = localStorage.getItem('cached_schemas') || '{}';
    const schemas = JSON.parse(cached);
    schemas[schema.tableName] = schema;
    localStorage.setItem('cached_schemas', JSON.stringify(schemas));
  } catch (error) {
    console.warn('Failed to cache schema:', error);
  }
};

export const getCachedSchema = (tableName: string): TableSchema | null => {
  try {
    const cached = localStorage.getItem('cached_schemas') || '{}';
    const schemas = JSON.parse(cached);
    return schemas[tableName] || null;
  } catch (error) {
    console.warn('Failed to retrieve cached schema:', error);
    return null;
  }
};