import { NextRequest, NextResponse } from 'next/server';
import DatabaseConnection from '@/utils/databaseConnection';
import { AIService } from '@/utils/aiService';

export async function POST(request: NextRequest) {
  try {
    const { query: userQuery } = await request.json();
    
    if (!userQuery || typeof userQuery !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Query is required and must be a string'
      }, { status: 400 });
    }
    
    console.log('🤖 API: Processing database query:', userQuery);
    
    const dbConnection = DatabaseConnection.getInstance();
    
    if (!dbConnection.isConnectedToDatabase()) {
      return NextResponse.json({
        success: false,
        error: 'Not connected to database. Please connect first.'
      }, { status: 400 });
    }
    
    // Get database schema for AI context
    const schemaContext = dbConnection.getSchemaForAI();
    
    // Use AI service to convert natural language to SQL with database schema context
    const aiResponse = await AIService.generateSQLFromQuery(userQuery, [], schemaContext);
    
    if (!aiResponse.query) {
      throw new Error('Failed to generate SQL query from natural language');
    }
    
    console.log('🎯 API: Generated SQL query:', aiResponse.query);
    
    // Execute the generated SQL query against the database
    const results = await dbConnection.executeQuery(aiResponse.query);
    
    console.log(`✅ API: Query executed successfully, returned ${results.length} rows`);
    
    return NextResponse.json({
      success: true,
      query: aiResponse.query,
      explanation: aiResponse.explanation,
      chartSuggestion: aiResponse.chartSuggestion,
      results: results,
      rowCount: results.length
    });
    
  } catch (error) {
    console.error('❌ API: Database query failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database query error'
    }, { status: 500 });
  }
}