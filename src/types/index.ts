export interface Dataset {
  id: string;
  name: string;
  data: Record<string, any>[];
  schema: TableSchema;
  uploadedAt: Date;
  isDatabase?: boolean;
  connectionInfo?: DatabaseConnectionInfo;
  tables?: DatabaseTable[]; // For database connections
}

export interface DatabaseTable {
  name: string;
  schema: string;
  columnCount: number;
  columns: DatabaseColumn[];
}

export interface DatabaseColumn {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

export interface DatabaseConnectionInfo {
  connected: boolean;
  tablesCount: number;
  connectionString?: string;
  lastConnected?: Date;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
}

export interface ColumnSchema {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATE';
  nullable: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  query?: string;
  result?: QueryResult;
  isStreaming?: boolean;
  streamingSteps?: StreamingStep[];
}

export interface StreamingStep {
  id: string;
  status: 'pending' | 'in-progress' | 'complete' | 'error';
  message: string;
  timestamp: Date;
  data?: any; // For SQL query, row count, etc.
}

export interface QueryResult {
  data: Record<string, any>[];
  columns: string[];
  rowCount: number;
  executionTime: number;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';
  data: any;
  options: any;
}

export interface AnalysisSession {
  id: string;
  name: string;
  dataset: Dataset;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIResponse {
  query: string;
  explanation: string;
  chartSuggestion?: ChartConfig;
}