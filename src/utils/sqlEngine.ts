import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Column {
  name: string;
  type: 'STRING' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATE';
}

interface Table {
  name: string;
  columns: Column[];
  data: Record<string, any>[];
}

export class SQLEngine {
  private static tables: Map<string, Table> = new Map();
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (!this.initialized) {
      this.tables.clear();
      this.initialized = true;
      console.log('SQLEngine initialized');
    }
  }

  static async loadCSVFile(file: File): Promise<void> {
    await this.initialize();
    
    const data = await this.parseCSV(file);
    await this.createTableFromData(data, 'dataset');
  }

  static async loadExcelFile(file: File): Promise<void> {
    await this.initialize();
    
    const data = await this.parseExcel(file);
    await this.createTableFromData(data, 'dataset');
  }

  static async loadSampleData(): Promise<void> {
    await this.initialize();
    
    // Load the sample CSV data with StateCode column
    const response = await fetch('/sample-data-with-states.csv');
    const csvText = await response.text();
    
    const data = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    }).data as Record<string, any>[];
    
    await this.createTableFromData(data, 'dataset');
  }

  private static async parseCSV(file: File): Promise<Record<string, any>[]> {
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

  private static async createTableFromData(data: Record<string, any>[], tableName: string): Promise<void> {
    if (data.length === 0) {
      throw new Error('No data to create table');
    }

    // Clean and prepare data
    const cleanedData = data.map(row => {
      const cleanRow: Record<string, any> = {};
      Object.keys(row).forEach(key => {
        let value = row[key];
        
        // Handle different data types
        if (value === null || value === undefined || value === '') {
          cleanRow[key] = null;
        } else if (typeof value === 'string') {
          // Convert boolean strings to actual booleans
          if (value.toLowerCase() === 'true') {
            cleanRow[key] = true;
          } else if (value.toLowerCase() === 'false') {
            cleanRow[key] = false;
          } else {
            cleanRow[key] = value;
          }
        } else {
          cleanRow[key] = value;
        }
      });
      return cleanRow;
    });

    // Infer column types
    const columns: Column[] = Object.keys(cleanedData[0]).map(columnName => ({
      name: columnName,
      type: this.inferDataType(cleanedData, columnName)
    }));

    // Create table
    const table: Table = {
      name: tableName,
      columns,
      data: cleanedData
    };

    this.tables.set(tableName, table);
    
    console.log(`Successfully loaded ${cleanedData.length} rows into table '${tableName}'`);
    console.log('Table schema:', columns);
  }

  private static inferDataType(data: Record<string, any>[], columnName: string): Column['type'] {
    const values = data.map(row => row[columnName]).filter(val => val !== null && val !== undefined && val !== '');
    
    if (values.length === 0) return 'STRING';

    // Check for boolean
    if (values.every(val => 
      typeof val === 'boolean' || 
      val === 'true' || val === 'false' || 
      val === 0 || val === 1 ||
      (typeof val === 'string' && (val.toLowerCase() === 'true' || val.toLowerCase() === 'false'))
    )) {
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

    return 'STRING';
  }

  static executeQuery(query: string): Record<string, any>[] {
    if (!this.initialized) {
      throw new Error('SQL Engine not initialized. Please load data first.');
    }

    try {
      console.log('Executing SQL query:', query);
      
      const result = this.parseAndExecuteSQL(query);
      
      console.log(`Query returned ${result.length} rows`);
      return result;
    } catch (error) {
      console.error('SQL execution error:', error);
      throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private static parseAndExecuteSQL(query: string): Record<string, any>[] {
    const normalizedQuery = query.trim().toLowerCase();
    
    // Parse SELECT queries
    if (normalizedQuery.startsWith('select')) {
      return this.executeSelectQuery(query);
    }
    
    throw new Error(`Unsupported query type: ${query}`);
  }

  private static executeSelectQuery(query: string): Record<string, any>[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Extract table name
    const fromMatch = normalizedQuery.match(/from\s+(\w+)/);
    if (!fromMatch) {
      throw new Error('FROM clause is required');
    }
    
    const tableName = fromMatch[1];
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table '${tableName}' does not exist`);
    }
    
    let result = [...table.data];
    
    // Apply WHERE clause - use original query to preserve case
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      result = this.applyWhereClause(result, whereClause);
    }
    
    // Apply GROUP BY clause
    const groupByMatch = normalizedQuery.match(/group\s+by\s+(.+?)(?:\s+order\s+by|\s+limit|$)/);
    if (groupByMatch) {
      const groupByClause = groupByMatch[1].trim();
      result = this.applyGroupBy(result, groupByClause, query);
    }
    
    // Apply ORDER BY clause
    const orderByMatch = normalizedQuery.match(/order\s+by\s+(.+?)(?:\s+limit|$)/);
    if (orderByMatch) {
      const orderByClause = orderByMatch[1].trim();
      result = this.applyOrderBy(result, orderByClause);
    }
    
    // Apply LIMIT clause
    const limitMatch = normalizedQuery.match(/limit\s+(\d+)/);
    if (limitMatch) {
      const limit = parseInt(limitMatch[1]);
      result = result.slice(0, limit);
    }
    
    // Apply column selection
    const selectMatch = query.match(/select\s+(.+?)\s+from/i);
    if (selectMatch) {
      const selectClause = selectMatch[1].trim();
      if (selectClause !== '*') {
        result = this.applyColumnSelection(result, selectClause);
      }
    }
    
    return result;
  }

  private static applyWhereClause(data: Record<string, any>[], whereClause: string): Record<string, any>[] {
    // Handle simple equality conditions: column = 'value' or column = value
    const equalityMatch = whereClause.match(/(\w+)\s*=\s*['"]([^'"]+)['"]|(\w+)\s*=\s*([^'"\s;]+)/);
    
    if (equalityMatch) {
      const column = equalityMatch[1] || equalityMatch[3];
      const value = equalityMatch[2] || equalityMatch[4];
      
      return data.filter(row => {
        const rowValue = row[column];
        
        // Handle string comparison (case-insensitive)
        if (typeof rowValue === 'string' && typeof value === 'string') {
          return rowValue.toLowerCase() === value.toLowerCase();
        }
        // Handle exact match for other types
        return rowValue == value;
      });
    }
    
    // Handle LIKE conditions: column LIKE '%value%'
    const likeMatch = whereClause.match(/(\w+)\s+like\s+['"]%([^%'"]+)%['"]?/i);
    if (likeMatch) {
      const column = likeMatch[1];
      const value = likeMatch[2];
      
      return data.filter(row => {
        const rowValue = row[column];
        if (typeof rowValue === 'string') {
          return rowValue.toLowerCase().includes(value.toLowerCase());
        }
        return false;
      });
    }
    
    // Handle numeric comparisons: column > value, column < value, etc.
    const comparisonMatch = whereClause.match(/(\w+)\s*([><=!]+)\s*(\d+(?:\.\d+)?)/);
    if (comparisonMatch) {
      const column = comparisonMatch[1];
      const operator = comparisonMatch[2];
      const value = parseFloat(comparisonMatch[3]);
      
      return data.filter(row => {
        const rowValue = parseFloat(row[column]);
        if (isNaN(rowValue)) return false;
        
        switch (operator) {
          case '>': return rowValue > value;
          case '<': return rowValue < value;
          case '>=': return rowValue >= value;
          case '<=': return rowValue <= value;
          case '=': return rowValue === value;
          case '!=': return rowValue !== value;
          default: return false;
        }
      });
    }
    
    return data;
  }

  private static applyGroupBy(data: Record<string, any>[], groupByClause: string, originalQuery: string): Record<string, any>[] {
    const groupColumn = groupByClause.trim();
    
    // Group data by the specified column
    const groups: Record<string, Record<string, any>[]> = {};
    data.forEach(row => {
      const groupValue = row[groupColumn] || 'NULL';
      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }
      groups[groupValue].push(row);
    });
    
    // Apply aggregation functions
    const result: Record<string, any>[] = [];
    
    Object.entries(groups).forEach(([groupValue, groupData]) => {
      const aggregatedRow: Record<string, any> = {};
      aggregatedRow[groupColumn] = groupValue === 'NULL' ? null : groupValue;
      
      // Parse SELECT clause for aggregation functions
      const selectMatch = originalQuery.match(/select\s+(.+?)\s+from/i);
      if (selectMatch) {
        const selectClause = selectMatch[1];
        
        // Handle COUNT(*)
        const countMatch = selectClause.match(/count\(\*\)\s+as\s+(\w+)/i);
        if (countMatch) {
          aggregatedRow[countMatch[1]] = groupData.length;
        }
        
        // Handle AVG(column)
        const avgMatch = selectClause.match(/avg\((\w+)\)\s+as\s+(\w+)/i);
        if (avgMatch) {
          const column = avgMatch[1];
          const alias = avgMatch[2];
          const sum = groupData.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
          aggregatedRow[alias] = Math.round((sum / groupData.length) * 100) / 100;
        }
        
        // Handle SUM(column)
        const sumMatch = selectClause.match(/sum\((\w+)\)\s+as\s+(\w+)/i);
        if (sumMatch) {
          const column = sumMatch[1];
          const alias = sumMatch[2];
          aggregatedRow[alias] = groupData.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
        }
      }
      
      result.push(aggregatedRow);
    });
    
    return result;
  }

  private static applyOrderBy(data: Record<string, any>[], orderByClause: string): Record<string, any>[] {
    const parts = orderByClause.split(/\s+/);
    const column = parts[0];
    const direction = parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    return data.sort((a, b) => {
      const aVal = a[column];
      const bVal = b[column];
      
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else {
        comparison = Number(aVal) - Number(bVal);
      }
      
      return direction === 'desc' ? -comparison : comparison;
    });
  }

  private static applyColumnSelection(data: Record<string, any>[], selectClause: string): Record<string, any>[] {
    const columns = selectClause.split(',').map(col => col.trim().replace(/\s+as\s+\w+/i, ''));
    
    return data.map(row => {
      const newRow: Record<string, any> = {};
      columns.forEach(col => {
        if (row.hasOwnProperty(col)) {
          newRow[col] = row[col];
        }
      });
      return newRow;
    });
  }

  static getTableSchema(tableName: string = 'dataset'): Array<{name: string, type: string}> {
    if (!this.initialized) {
      throw new Error('SQL Engine not initialized');
    }

    const table = this.tables.get(tableName);
    if (!table) {
      return [];
    }

    return table.columns.map(col => ({
      name: col.name,
      type: col.type
    }));
  }

  static getRowCount(tableName: string = 'dataset'): number {
    if (!this.initialized) {
      return 0;
    }

    const table = this.tables.get(tableName);
    return table ? table.data.length : 0;
  }

  static isInitialized(): boolean {
    return this.initialized;
  }

  static reset(): void {
    this.tables.clear();
    this.initialized = false;
  }
}