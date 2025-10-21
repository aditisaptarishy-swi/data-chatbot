export interface Dataset {
  id: string;
  name: string;
  data: Record<string, any>[];
  schema: TableSchema;
  uploadedAt: Date;
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