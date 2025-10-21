import sql from 'mssql';
import { DefaultAzureCredential } from '@azure/identity';

interface DatabaseSchema {
  tables: DatabaseTable[];
}

interface DatabaseTable {
  name: string;
  schema: string;
  columns: DatabaseColumn[];
}

interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  referencedTable?: string;
  referencedColumn?: string;
}

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: sql.ConnectionPool | null = null;
  private schema: DatabaseSchema | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.pool) {
      return;
    }

    try {
      const connectionString = process.env.MATCHING_CONNECTION_STRING;
      if (!connectionString) {
        throw new Error('MATCHING_CONNECTION_STRING environment variable is not set');
      }

      console.log('🔌 Connecting to SQL Server database...');
      
      // Parse connection string to extract server and database
      const serverMatch = connectionString.match(/Server=([^;]+)/i);
      const databaseMatch = connectionString.match(/Database=([^;]+)/i);
      
      if (!serverMatch || !databaseMatch) {
        throw new Error('Invalid connection string format');
      }
      
      const server = serverMatch[1];
      const database = databaseMatch[1];
      
      // Create connection pool with Entra ID authentication
      const config: sql.config = {
        server,
        database,
        authentication: {
          type: 'azure-active-directory-default',
          options: {}
        },
        options: {
          encrypt: true,
          trustServerCertificate: true,
          enableArithAbort: true,
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
        requestTimeout: 60000, // 60 seconds
        connectionTimeout: 60000, // 60 seconds
      };

      this.pool = new sql.ConnectionPool(config);
      await this.pool.connect();
      
      this.isConnected = true;
      console.log('✅ Successfully connected to SQL Server database');
      
      // Load database schema
      await this.loadSchema();
      
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      this.isConnected = false;
      
      // Provide more specific error messages for common issues
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('Deny Public Network Access')) {
        errorMessage = 'Database connection blocked: The Azure SQL Server has "Deny Public Network Access" enabled. Please contact your database administrator to whitelist your IP address or enable public network access.';
      } else if (errorMessage.includes('authentication')) {
        errorMessage = 'Authentication failed: Please ensure you have proper Azure Active Directory permissions for this database.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Connection timeout: The database server is not responding. Please check your network connection and server availability.';
      }
      
      throw new Error(`Database connection failed: ${errorMessage}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
      this.isConnected = false;
      this.schema = null;
      console.log('🔌 Disconnected from SQL Server database');
    }
  }

  private async loadSchema(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      console.log('📋 Loading database schema...');
      
      // Query to get all tables and their columns (SQL Server compatible)
      const schemaQuery = `
        SELECT
          t.TABLE_SCHEMA,
          t.TABLE_NAME,
          c.COLUMN_NAME,
          c.DATA_TYPE,
          c.IS_NULLABLE,
          CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY,
          CASE WHEN fk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_FOREIGN_KEY,
          fk.REFERENCED_TABLE_NAME,
          fk.REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLES t
        INNER JOIN INFORMATION_SCHEMA.COLUMNS c
          ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
        LEFT JOIN (
          SELECT
            ku.TABLE_SCHEMA,
            ku.TABLE_NAME,
            ku.COLUMN_NAME
          FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
          INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
            ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
            AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
          WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA
             AND c.TABLE_NAME = pk.TABLE_NAME
             AND c.COLUMN_NAME = pk.COLUMN_NAME
        LEFT JOIN (
          SELECT
            fku.TABLE_SCHEMA,
            fku.TABLE_NAME,
            fku.COLUMN_NAME,
            pku.TABLE_NAME as REFERENCED_TABLE_NAME,
            pku.COLUMN_NAME as REFERENCED_COLUMN_NAME
          FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
          INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE fku
            ON rc.CONSTRAINT_NAME = fku.CONSTRAINT_NAME
            AND rc.CONSTRAINT_SCHEMA = fku.CONSTRAINT_SCHEMA
          INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE pku
            ON rc.UNIQUE_CONSTRAINT_NAME = pku.CONSTRAINT_NAME
            AND rc.UNIQUE_CONSTRAINT_SCHEMA = pku.CONSTRAINT_SCHEMA
        ) fk ON c.TABLE_SCHEMA = fk.TABLE_SCHEMA
             AND c.TABLE_NAME = fk.TABLE_NAME
             AND c.COLUMN_NAME = fk.COLUMN_NAME
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION
      `;

      const result = await this.pool.request().query(schemaQuery);
      
      // Group results by table
      const tablesMap = new Map<string, DatabaseTable>();
      
      for (const row of result.recordset) {
        const tableKey = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
        
        if (!tablesMap.has(tableKey)) {
          tablesMap.set(tableKey, {
            name: row.TABLE_NAME,
            schema: row.TABLE_SCHEMA,
            columns: []
          });
        }
        
        const table = tablesMap.get(tableKey)!;
        table.columns.push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE,
          nullable: row.IS_NULLABLE === 'YES',
          isPrimaryKey: row.IS_PRIMARY_KEY === 1,
          isForeignKey: row.IS_FOREIGN_KEY === 1,
          referencedTable: row.REFERENCED_TABLE_NAME,
          referencedColumn: row.REFERENCED_COLUMN_NAME
        });
      }
      
      this.schema = {
        tables: Array.from(tablesMap.values())
      };
      
      console.log(`✅ Loaded schema for ${this.schema.tables.length} tables`);
      
    } catch (error) {
      console.error('❌ Failed to load database schema:', error);
      throw new Error(`Schema loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async executeQuery(query: string): Promise<any[]> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    try {
      console.log('🔍 Executing database query:', query);
      const result = await this.pool.request().query(query);
      console.log(`✅ Query executed successfully, returned ${result.recordset.length} rows`);
      return result.recordset;
    } catch (error) {
      console.error('❌ Query execution failed:', error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getSchema(): DatabaseSchema | null {
    return this.schema;
  }

  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  getSchemaForAI(): string {
    if (!this.schema) {
      return 'No database schema available';
    }

    let schemaDescription = 'Available database tables and columns:\n\n';
    
    for (const table of this.schema.tables) {
      schemaDescription += `Table: ${table.schema}.${table.name}\n`;
      schemaDescription += 'Columns:\n';
      
      for (const column of table.columns) {
        let columnInfo = `  - ${column.name} (${column.type})`;
        if (column.isPrimaryKey) columnInfo += ' [PRIMARY KEY]';
        if (column.isForeignKey) columnInfo += ` [FOREIGN KEY -> ${column.referencedTable}.${column.referencedColumn}]`;
        if (!column.nullable) columnInfo += ' [NOT NULL]';
        schemaDescription += columnInfo + '\n';
      }
      schemaDescription += '\n';
    }
    
    return schemaDescription;
  }
}

export default DatabaseConnection;
export type { DatabaseSchema, DatabaseTable, DatabaseColumn };