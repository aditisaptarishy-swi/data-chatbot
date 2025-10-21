import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '@/utils/databaseConnection';

export async function POST(request: NextRequest) {
  try {
    console.log('🔌 API: Attempting to connect to USDB database...');
    
    const dbConnection = DatabaseConnection.getInstance();
    await dbConnection.connect();
    
    const schema = dbConnection.getSchema();
    
    if (!schema) {
      throw new Error('Failed to load database schema');
    }
    
    console.log(`✅ API: Successfully connected to database with ${schema.tables.length} tables`);
    
    return NextResponse.json({
      success: true,
      message: 'Successfully connected to USDB database',
      tablesCount: schema.tables.length,
      tables: schema.tables.map(table => ({
        name: table.name,
        schema: table.schema,
        columnCount: table.columns.length,
        columns: table.columns.map(col => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable,
          isPrimaryKey: col.isPrimaryKey,
          isForeignKey: col.isForeignKey
        }))
      }))
    });
    
  } catch (error) {
    console.error('❌ API: Database connection failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database connection error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const dbConnection = DatabaseConnection.getInstance();
    
    if (!dbConnection.isConnectedToDatabase()) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'Not connected to database'
      });
    }
    
    const schema = dbConnection.getSchema();
    
    return NextResponse.json({
      success: true,
      connected: true,
      tablesCount: schema?.tables.length || 0,
      tables: schema?.tables.map(table => ({
        name: table.name,
        schema: table.schema,
        columnCount: table.columns.length
      })) || []
    });
    
  } catch (error) {
    console.error('❌ API: Failed to get connection status:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}