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
    
    // Load the sample automotive CSV data with StateCode and SpecYear columns
    const response = await fetch('/sample-automotive-data.csv');
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
    
    // Apply GROUP BY clause - use original query to preserve case
    const groupByMatch = query.match(/GROUP\s+BY\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|$)/i);
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
    // Handle complex WHERE clauses with AND, OR operators
    return this.evaluateWhereExpression(data, whereClause);
  }

  private static evaluateWhereExpression(data: Record<string, any>[], expression: string): Record<string, any>[] {
    // Normalize whitespace and newlines for proper parsing
    const normalizedExpression = expression.replace(/\s+/g, ' ').trim();
    
    // Handle OR conditions first (lower precedence)
    if (normalizedExpression.includes(' OR ')) {
      const orParts = normalizedExpression.split(' OR ');
      const results = new Set<Record<string, any>>();
      
      orParts.forEach(part => {
        const partResults = this.evaluateWhereExpression(data, part.trim());
        partResults.forEach(row => results.add(row));
      });
      
      return Array.from(results);
    }
    
    // Handle AND conditions (higher precedence)
    if (normalizedExpression.includes(' AND ')) {
      const andParts = normalizedExpression.split(' AND ');
      let result = data;
      
      andParts.forEach(part => {
        result = this.evaluateWhereExpression(result, part.trim());
      });
      
      return result;
    }
    
    // Handle single conditions
    return this.evaluateSingleCondition(data, normalizedExpression);
  }

  private static evaluateSingleCondition(data: Record<string, any>[], condition: string): Record<string, any>[] {
    // Remove parentheses if present
    condition = condition.replace(/^\(|\)$/g, '').trim();
    
    // Handle LIKE conditions: column LIKE '%value%'
    const likeMatch = condition.match(/(\w+)\s+LIKE\s+['"]%([^%'"]+)%['"]?/i);
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
    
    // Handle IN conditions: column IN ('value1', 'value2')
    const inMatch = condition.match(/(\w+)\s+IN\s*\(([^)]+)\)/i);
    if (inMatch) {
      const column = inMatch[1];
      const values = inMatch[2].split(',').map(v => v.trim().replace(/['"]/g, ''));
      
      return data.filter(row => {
        const rowValue = String(row[column]);
        return values.some(val => rowValue.toLowerCase() === val.toLowerCase());
      });
    }
    
    // Handle BETWEEN conditions: column BETWEEN value1 AND value2
    const betweenMatch = condition.match(/(\w+)\s+BETWEEN\s+(\d+(?:\.\d+)?)\s+AND\s+(\d+(?:\.\d+)?)/i);
    if (betweenMatch) {
      const column = betweenMatch[1];
      const min = parseFloat(betweenMatch[2]);
      const max = parseFloat(betweenMatch[3]);
      
      return data.filter(row => {
        const rowValue = parseFloat(row[column]);
        return !isNaN(rowValue) && rowValue >= min && rowValue <= max;
      });
    }
    
    // Handle IS NULL / IS NOT NULL
    const nullMatch = condition.match(/(\w+)\s+IS\s+(NOT\s+)?NULL/i);
    if (nullMatch) {
      const column = nullMatch[1];
      const isNotNull = !!nullMatch[2];
      
      return data.filter(row => {
        const rowValue = row[column];
        const isNull = rowValue === null || rowValue === undefined || rowValue === '';
        return isNotNull ? !isNull : isNull;
      });
    }
    
    // Handle comparison operators: =, !=, <>, >, <, >=, <=
    const comparisonMatch = condition.match(/(\w+)\s*([><=!]+|<>)\s*(['"]?)([^'"]*)\3/);
    if (comparisonMatch) {
      const column = comparisonMatch[1];
      const operator = comparisonMatch[2];
      const value = comparisonMatch[4];
      
      return data.filter(row => {
        const rowValue = row[column];
        
        // Try numeric comparison first if both values can be converted to numbers
        const rowNum = parseFloat(String(rowValue));
        const valNum = parseFloat(String(value));
        
        if (!isNaN(rowNum) && !isNaN(valNum)) {
          switch (operator) {
            case '=': return rowNum === valNum;
            case '!=':
            case '<>': return rowNum !== valNum;
            case '>': return rowNum > valNum;
            case '<': return rowNum < valNum;
            case '>=': return rowNum >= valNum;
            case '<=': return rowNum <= valNum;
            default: return false;
          }
        }
        
        // Fallback to string comparison (case-insensitive for equality)
        const rowStr = String(rowValue).toLowerCase();
        const valStr = String(value).toLowerCase();
        
        switch (operator) {
          case '=': return rowStr === valStr;
          case '!=':
          case '<>': return rowStr !== valStr;
          case '>': return rowStr > valStr;
          case '<': return rowStr < valStr;
          case '>=': return rowStr >= valStr;
          case '<=': return rowStr <= valStr;
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
      const groupValue = row[groupColumn];
      const groupKey = (groupValue === null || groupValue === undefined || groupValue === '') ? 'NULL' : String(groupValue);
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(row);
    });
    
    // Parse SELECT clause to understand what columns and aggregations are needed
    // Handle edge cases and complex SELECT clauses robustly
    let selectClause: string = '';
    
    // Clean the query first - remove extra whitespace and normalize line breaks
    const cleanQuery = originalQuery.replace(/\s+/g, ' ').trim();
    
    // Try multiple regex patterns to handle different SELECT clause formats
    const patterns = [
      /select\s+(.*?)\s+from\s+\w+/i,     // Standard: SELECT ... FROM table
      /select\s+(.*?)\s+from/i,           // Fallback: SELECT ... FROM
      /select\s+(.*)\s+from\s+\w+/i,      // Greedy: SELECT ... FROM table
      /select\s+(.+?)\s+from/i,           // Simple: SELECT ... FROM
      /select\s+(.*?)(?:\s+from|\s*$)/i,  // Last resort: SELECT ... (with or without FROM)
      /select\s+(.+)/i                    // Ultimate fallback: SELECT ...
    ];
    
    let matched = false;
    for (const pattern of patterns) {
      const match = cleanQuery.match(pattern);
      if (match && match[1] && match[1].trim()) {
        selectClause = match[1].trim();
        matched = true;
        break;
      }
    }
    
    // If still no match, try with the original query (in case cleaning broke something)
    if (!matched) {
      for (const pattern of patterns) {
        const match = originalQuery.match(pattern);
        if (match && match[1] && match[1].trim()) {
          selectClause = match[1].trim();
          matched = true;
          break;
        }
      }
    }
    
    if (!matched || !selectClause) {
      console.error('Failed to parse SELECT clause from query:', originalQuery);
      console.error('Cleaned query:', cleanQuery);
      console.error('Query length:', originalQuery.length);
      
      // Try one more desperate attempt - extract everything between SELECT and FROM manually
      const selectIndex = originalQuery.toLowerCase().indexOf('select');
      const fromIndex = originalQuery.toLowerCase().indexOf('from');
      
      if (selectIndex !== -1 && fromIndex !== -1 && fromIndex > selectIndex) {
        const extracted = originalQuery.substring(selectIndex + 6, fromIndex).trim();
        if (extracted) {
          console.log('Manual extraction succeeded:', extracted);
          selectClause = extracted;
          matched = true;
        }
      }
      
      if (!matched) {
        throw new Error('Invalid SELECT clause - unable to parse column specifications');
      }
    }
    const columnSpecs = selectClause.split(',').map(col => col.trim());
    
    // Apply aggregation functions
    const result: Record<string, any>[] = [];
    
    Object.entries(groups).forEach(([groupKey, groupData]) => {
      const aggregatedRow: Record<string, any> = {};
      
      // Process each column specification
      columnSpecs.forEach(colSpec => {
        // Handle COUNT(*)
        const countMatch = colSpec.match(/count\(\*\)\s+(?:as\s+)?(\w+)/i);
        if (countMatch) {
          const alias = countMatch[1];
          aggregatedRow[alias] = groupData.length;
          return;
        }
        
        // Handle AVG(column)
        const avgMatch = colSpec.match(/avg\((\w+)\)\s+(?:as\s+)?(\w+)/i);
        if (avgMatch) {
          const column = avgMatch[1];
          const alias = avgMatch[2];
          const sum = groupData.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
          aggregatedRow[alias] = Math.round((sum / groupData.length) * 100) / 100;
          return;
        }
        
        // Handle SUM(column)
        const sumMatch = colSpec.match(/sum\((\w+)\)\s+(?:as\s+)?(\w+)/i);
        if (sumMatch) {
          const column = sumMatch[1];
          const alias = sumMatch[2];
          aggregatedRow[alias] = groupData.reduce((acc, row) => acc + (Number(row[column]) || 0), 0);
          return;
        }
        
        // Handle regular columns (group by columns or other non-aggregated columns)
        const aliasMatch = colSpec.match(/^(.+?)\s+(?:as\s+)?(\w+)$/i);
        if (aliasMatch) {
          // Column with alias: SpecMake AS Make
          const sourceColumn = aliasMatch[1].trim();
          const targetColumn = aliasMatch[2].trim();
          
          if (sourceColumn === groupColumn) {
            // This is the group by column
            aggregatedRow[targetColumn] = groupKey === 'NULL' ? null : groupKey;
          }
        } else {
          // Column without alias
          const columnName = colSpec.trim();
          if (columnName === groupColumn) {
            aggregatedRow[columnName] = groupKey === 'NULL' ? null : groupKey;
          }
        }
      });
      
      result.push(aggregatedRow);
    });
    
    return result;
  }

  private static applyOrderBy(data: Record<string, any>[], orderByClause: string): Record<string, any>[] {
    // Handle multiple columns: ORDER BY col1 ASC, col2 DESC
    const orderColumns = orderByClause.split(',').map(col => {
      const parts = col.trim().split(/\s+/);
      return {
        column: parts[0],
        direction: parts[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc'
      };
    });
    
    return data.sort((a, b) => {
      for (const { column, direction } of orderColumns) {
        const aVal = a[column];
        const bVal = b[column];
        
        if (aVal === null || aVal === undefined) {
          if (bVal === null || bVal === undefined) continue;
          return 1;
        }
        if (bVal === null || bVal === undefined) return -1;
        
        let comparison = 0;
        
        // Handle different data types
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (!isNaN(Date.parse(aVal)) && !isNaN(Date.parse(bVal))) {
          // Handle dates
          comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
        } else {
          // Fallback to string comparison
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        if (comparison !== 0) {
          return direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
  }

  private static applyColumnSelection(data: Record<string, any>[], selectClause: string): Record<string, any>[] {
    const columnSpecs = selectClause.split(',').map(col => col.trim());
    
    return data.map(row => {
      const newRow: Record<string, any> = {};
      
      columnSpecs.forEach(colSpec => {
        // Handle column aliases: "ColumnName AS Alias" or "ColumnName Alias"
        const aliasMatch = colSpec.match(/^(.+?)\s+(?:AS\s+)?(\w+)$/i);
        
        if (aliasMatch) {
          // Column with alias
          const sourceColumn = aliasMatch[1].trim();
          const targetColumn = aliasMatch[2].trim();
          
          if (row.hasOwnProperty(sourceColumn)) {
            newRow[targetColumn] = row[sourceColumn];
          }
        } else {
          // Column without alias
          const columnName = colSpec.trim();
          if (row.hasOwnProperty(columnName)) {
            newRow[columnName] = row[columnName];
          }
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