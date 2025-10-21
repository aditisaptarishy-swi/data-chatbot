import { TableSchema, AIResponse, ChartConfig } from '@/types';

export class AIService {
  private static readonly API_URL = 'https://16c0c1a36195.ngrok-free.app/api/generate';

  static async generateSQL(prompt: string, schema: TableSchema): Promise<AIResponse> {
    try {
      // First try the AI API
      console.log('🤖 Attempting to connect to AI API:', this.API_URL);
      const systemPrompt = this.buildSystemPrompt(schema);
      const fullPrompt = `${systemPrompt}\n\nUser Query: ${prompt}\n\nPlease provide:
1. A SQL query to answer this question
2. A brief explanation of what the query does
3. If applicable, suggest a chart type for visualizing the results

Format your response as JSON with the following structure:
{
  "query": "SELECT ...",
  "explanation": "This query...",
  "chartSuggestion": {
    "type": "bar|line|pie|doughnut|scatter",
    "reasoning": "This chart type is suitable because..."
  }
}`;

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-oss:120b',
          prompt: fullPrompt,
          stream: true
        })
      });

      if (!response.ok) {
        console.warn(`AI API failed with status ${response.status}, falling back to simple query generation`);
        return this.generateFallbackQuery(prompt, schema);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        console.warn('No response body reader available, falling back to simple query generation');
        return this.generateFallbackQuery(prompt, schema);
      }

      let result = '';
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          result += chunk;
        }
      } catch (streamError) {
        console.error('Error reading stream:', streamError);
        return this.generateFallbackQuery(prompt, schema);
      }

      console.log('✅ AI API response received, length:', result.length);
      const aiResponse = this.parseAIResponse(result);
      
      // If AI response is empty, use fallback
      if (!aiResponse.query) {
        console.warn('AI returned empty query, falling back to simple query generation');
        return this.generateFallbackQuery(prompt, schema);
      }
      
      console.log('🎯 Using AI-generated query:', aiResponse.query);
      return aiResponse;
    } catch (error) {
      console.error('AI Service Error:', error);
      console.log('Falling back to simple query generation');
      return this.generateFallbackQuery(prompt, schema);
    }
  }

  private static generateFallbackQuery(prompt: string, schema: TableSchema): AIResponse {
    const lowerPrompt = prompt.toLowerCase().trim();
    const tableName = schema.tableName;
    const columns = schema.columns.map(col => col.name);
    
    let query = '';
    let explanation = '';
    let chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' = 'bar';
    
    // Count queries
    if (lowerPrompt.includes('count') || lowerPrompt.includes('total number')) {
      if (lowerPrompt.includes('by') || lowerPrompt.includes('group')) {
        // Group by queries
        const groupColumn = this.extractColumnFromPrompt(lowerPrompt, columns);
        if (groupColumn) {
          query = `SELECT ${groupColumn}, COUNT(*) as count FROM ${tableName} GROUP BY ${groupColumn} ORDER BY count DESC`;
          explanation = `Counts records grouped by ${groupColumn} in the ${tableName} table`;
          chartType = 'pie';
        } else {
          query = `SELECT COUNT(*) as total_records FROM ${tableName}`;
          explanation = `Counts the total number of records in the ${tableName} table`;
        }
      } else {
        query = `SELECT COUNT(*) as total_records FROM ${tableName}`;
        explanation = `Counts the total number of records in the ${tableName} table`;
      }
    }
    // Average queries
    else if (lowerPrompt.includes('average') || lowerPrompt.includes('avg')) {
      const numericColumn = this.extractNumericColumn(lowerPrompt, schema.columns);
      if (numericColumn) {
        if (lowerPrompt.includes('by') || lowerPrompt.includes('group')) {
          const groupColumn = this.extractColumnFromPrompt(lowerPrompt, columns);
          if (groupColumn) {
            query = `SELECT ${groupColumn}, AVG(${numericColumn}) as avg_${numericColumn} FROM ${tableName} GROUP BY ${groupColumn} ORDER BY avg_${numericColumn} DESC`;
            explanation = `Shows average ${numericColumn} grouped by ${groupColumn}`;
            chartType = 'bar';
          } else {
            query = `SELECT AVG(${numericColumn}) as avg_${numericColumn} FROM ${tableName}`;
            explanation = `Shows average ${numericColumn} in the ${tableName} table`;
          }
        } else {
          query = `SELECT AVG(${numericColumn}) as avg_${numericColumn} FROM ${tableName}`;
          explanation = `Shows average ${numericColumn} in the ${tableName} table`;
        }
      } else {
        query = `SELECT * FROM ${tableName} LIMIT 10`;
        explanation = `Could not identify numeric column for average. Showing first 10 rows instead.`;
      }
    }
    // Sum queries
    else if (lowerPrompt.includes('sum') || lowerPrompt.includes('total')) {
      const numericColumn = this.extractNumericColumn(lowerPrompt, schema.columns);
      if (numericColumn) {
        if (lowerPrompt.includes('by') || lowerPrompt.includes('group')) {
          const groupColumn = this.extractColumnFromPrompt(lowerPrompt, columns);
          if (groupColumn) {
            query = `SELECT ${groupColumn}, SUM(${numericColumn}) as total_${numericColumn} FROM ${tableName} GROUP BY ${groupColumn} ORDER BY total_${numericColumn} DESC`;
            explanation = `Shows total ${numericColumn} grouped by ${groupColumn}`;
            chartType = 'bar';
          } else {
            query = `SELECT SUM(${numericColumn}) as total_${numericColumn} FROM ${tableName}`;
            explanation = `Shows total ${numericColumn} in the ${tableName} table`;
          }
        } else {
          query = `SELECT SUM(${numericColumn}) as total_${numericColumn} FROM ${tableName}`;
          explanation = `Shows total ${numericColumn} in the ${tableName} table`;
        }
      } else {
        query = `SELECT * FROM ${tableName} LIMIT 10`;
        explanation = `Could not identify numeric column for sum. Showing first 10 rows instead.`;
      }
    }
    // First/Top N rows
    else if (lowerPrompt.includes('first') || lowerPrompt.includes('top')) {
      const limitMatch = lowerPrompt.match(/(?:first|top)\s+(\d+)/);
      const limit = limitMatch ? parseInt(limitMatch[1]) : 10;
      query = `SELECT * FROM ${tableName} LIMIT ${limit}`;
      explanation = `Shows the first ${limit} rows from the ${tableName} table`;
    }
    // Column names
    else if (lowerPrompt.includes('column') || lowerPrompt.includes('schema') || lowerPrompt.includes('structure')) {
      // For column names, we'll return a special query that the processor will handle differently
      query = `SHOW COLUMNS FROM ${tableName}`;
      explanation = `Shows the column names and types of the ${tableName} table`;
    }
    // Show all
    else if (lowerPrompt.includes('all') || lowerPrompt.includes('everything')) {
      query = `SELECT * FROM ${tableName}`;
      explanation = `Shows all records from the ${tableName} table`;
    }
    // Where conditions
    else if (lowerPrompt.includes('where') || lowerPrompt.includes('>') || lowerPrompt.includes('<') || lowerPrompt.includes('=')) {
      // Basic WHERE clause handling
      query = `SELECT * FROM ${tableName}`;
      explanation = `Shows filtered results from the ${tableName} table (WHERE clause parsing not fully implemented in demo)`;
    }
    // Default fallback - ask for clarification instead of showing default data
    else {
      // Check if the prompt seems to be asking a question but is unclear
      if (lowerPrompt.includes('?') || lowerPrompt.includes('what') || lowerPrompt.includes('how') || lowerPrompt.includes('show')) {
        query = `CLARIFICATION_NEEDED`;
        explanation = `I'm not sure what you're looking for. Could you please be more specific? For example:\n• "Show me the first 10 rows"\n• "Count the total number of records"\n• "What are the column names?"\n• "Average [column] by [group]"`;
      } else {
        query = `SELECT * FROM ${tableName} LIMIT 10`;
        explanation = `Shows the first 10 rows from the ${tableName} table (default query)`;
      }
    }
    
    return {
      query,
      explanation,
      chartSuggestion: {
        type: chartType,
        data: null,
        options: null
      }
    };
  }

  private static extractColumnFromPrompt(prompt: string, columns: string[]): string | null {
    // Look for "by [column]" pattern first
    const byMatch = prompt.match(/by\s+(\w+)/i);
    if (byMatch) {
      const mentionedColumn = byMatch[1].toLowerCase();
      const matchedColumn = columns.find(col => col.toLowerCase() === mentionedColumn);
      if (matchedColumn) return matchedColumn;
    }
    
    // Then check for direct column mentions
    for (const column of columns) {
      if (prompt.includes(column.toLowerCase())) {
        return column;
      }
    }
    return null;
  }

  private static extractNumericColumn(prompt: string, columns: { name: string; type: string }[]): string | null {
    // Look for specific numeric column mentions in the prompt
    const numericKeywords = ['salary', 'age', 'price', 'amount', 'cost', 'revenue', 'income'];
    
    for (const keyword of numericKeywords) {
      if (prompt.toLowerCase().includes(keyword)) {
        const matchedCol = columns.find(col =>
          col.name.toLowerCase().includes(keyword) &&
          (col.type === 'INTEGER' || col.type === 'REAL')
        );
        if (matchedCol) return matchedCol.name;
      }
    }
    
    // Then try to find column mentioned in prompt
    for (const col of columns) {
      if (prompt.includes(col.name.toLowerCase()) && (col.type === 'INTEGER' || col.type === 'REAL')) {
        return col.name;
      }
    }
    
    // Fallback to first numeric column
    const numericCol = columns.find(col => col.type === 'INTEGER' || col.type === 'REAL');
    return numericCol ? numericCol.name : null;
  }

  private static buildSystemPrompt(schema: TableSchema): string {
    const tableInfo = `Table: ${schema.tableName}
Columns:
${schema.columns.map(col => `- ${col.name} (${col.type}${col.nullable ? ', nullable' : ''})`).join('\n')}`;

    return `You are a SQL expert. Given the following database schema, generate accurate SQL queries to answer user questions.

${tableInfo}

Rules:
1. Use proper SQL syntax
2. Always use the exact table name: ${schema.tableName}
3. Use exact column names as provided in the schema
4. For aggregations, use appropriate GROUP BY clauses
5. For filtering, use proper WHERE conditions
6. For sorting, use ORDER BY
7. Be case-sensitive with column names
8. If the query involves counting, use COUNT()
9. If the query involves averages, use AVG()
10. If the query involves sums, use SUM()
11. Always provide a complete, executable SQL query`;
  }

  private static parseAIResponse(response: string): AIResponse {
    try {
      console.log('🔍 Raw AI response (first 500 chars):', response.substring(0, 500));
      
      // Clean the response - remove any streaming artifacts
      let cleanResponse = response.trim();
      
      // Handle the specific streaming format from your AI model
      // The response contains multiple JSON objects with "thinking" fields
      let fullThinkingContent = '';
      let fullResponseContent = '';
      
      // Split by lines and parse each JSON object
      const lines = cleanResponse.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line.trim());
          
          // Extract thinking content (where the SQL query is)
          if (parsed.thinking) {
            fullThinkingContent += parsed.thinking;
          }
          
          // Extract response content (if any)
          if (parsed.response) {
            fullResponseContent += parsed.response;
          }
        } catch (lineError) {
          // Skip lines that aren't valid JSON
          continue;
        }
      }
      
      console.log('🧠 Extracted thinking content:', fullThinkingContent);
      console.log('💬 Extracted response content:', fullResponseContent);
      
      // Try to parse the response content as JSON first (preferred method)
      if (fullResponseContent.trim()) {
        try {
          const responseJson = JSON.parse(fullResponseContent.trim());
          console.log('✅ Successfully parsed response JSON:', responseJson);
          
          if (responseJson.query) {
            return {
              query: responseJson.query,
              explanation: responseJson.explanation || 'Query generated by AI model',
              chartSuggestion: responseJson.chartSuggestion ? {
                type: responseJson.chartSuggestion.type || 'bar',
                data: null,
                options: null
              } : {
                type: 'bar',
                data: null,
                options: null
              }
            };
          }
        } catch (jsonError) {
          console.log('📝 Response content is not JSON, trying thinking content');
        }
      }
      
      // Fallback: extract SQL from thinking content
      let sqlQuery = '';
      let explanation = 'Query generated by AI model';
      
      if (fullThinkingContent) {
        // Look for SQL query in thinking content
        const sqlMatch = fullThinkingContent.match(/SELECT[\s\S]*?(?=;|\.|\n\n|Explanation)/i);
        if (sqlMatch) {
          sqlQuery = sqlMatch[0].trim();
          if (!sqlQuery.endsWith(';')) {
            sqlQuery += ';';
          }
        }
      }
      
      console.log('🎯 Final extracted SQL query:', sqlQuery);
      
      // Validate that we have a meaningful SQL query
      if (sqlQuery && (
        sqlQuery.toUpperCase().includes('SELECT') ||
        sqlQuery.toUpperCase().includes('SHOW') ||
        sqlQuery.toUpperCase().includes('COUNT') ||
        sqlQuery.toUpperCase().includes('AVG') ||
        sqlQuery.toUpperCase().includes('SUM')
      )) {
        return {
          query: sqlQuery,
          explanation,
          chartSuggestion: {
            type: 'bar',
            data: null,
            options: null
          }
        };
      }
      
      // Fallback: try original parsing methods
      console.log('🧹 Cleaned AI response (first 500 chars):', cleanResponse.substring(0, 500));
      
      // Try to extract JSON from the cleaned response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Successfully parsed JSON:', parsed);
          return {
            query: parsed.query || '',
            explanation: parsed.explanation || 'Query generated successfully',
            chartSuggestion: parsed.chartSuggestion ? {
              type: parsed.chartSuggestion.type || 'bar',
              data: null,
              options: null
            } : undefined
          };
        } catch (jsonError) {
          console.error('❌ JSON parsing failed:', jsonError);
        }
      }

      // Try to extract SQL query directly from response
      const sqlMatch = cleanResponse.match(/SELECT[\s\S]*?(?=\n\n|\n$|$|;)/i);
      if (sqlMatch) {
        console.log('📝 Extracted SQL query:', sqlMatch[0]);
        return {
          query: sqlMatch[0].trim(),
          explanation: 'Generated SQL query from natural language prompt',
          chartSuggestion: undefined
        };
      }

      console.warn('⚠️ No SQL query found in AI response');
      return {
        query: '',
        explanation: 'Could not extract SQL query from AI response',
        chartSuggestion: undefined
      };
    } catch (error) {
      console.error('❌ Failed to parse AI response:', error);
      console.log('Raw response that failed:', response);
      return {
        query: '',
        explanation: 'Failed to parse AI response',
        chartSuggestion: undefined
      };
    }
  }

  static generateChartConfig(data: Record<string, any>[], chartType: string, columns: string[]): ChartConfig | null {
    if (!data || data.length === 0 || !columns || columns.length === 0) {
      return null;
    }

    try {
      switch (chartType) {
        case 'bar':
        case 'line':
          return this.generateBarLineChart(data, chartType as 'bar' | 'line', columns);
        case 'pie':
        case 'doughnut':
          return this.generatePieChart(data, chartType as 'pie' | 'doughnut', columns);
        case 'scatter':
          return this.generateScatterChart(data, columns);
        default:
          return this.generateBarLineChart(data, 'bar', columns);
      }
    } catch (error) {
      console.error('Failed to generate chart config:', error);
      return null;
    }
  }

  private static generateBarLineChart(data: Record<string, any>[], type: 'bar' | 'line', columns: string[]): ChartConfig {
    const labels = data.map((row, index) => row[columns[0]] || `Row ${index + 1}`);
    const datasets = columns.slice(1).map((col, index) => ({
      label: col,
      data: data.map(row => row[col] || 0),
      backgroundColor: this.getColor(index, 0.6),
      borderColor: this.getColor(index, 1),
      borderWidth: 2,
      fill: type === 'line' ? false : true
    }));

    return {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#e5e7eb' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          }
        }
      }
    };
  }

  private static generatePieChart(data: Record<string, any>[], type: 'pie' | 'doughnut', columns: string[]): ChartConfig {
    const labels = data.map((row, index) => row[columns[0]] || `Item ${index + 1}`);
    const values = data.map(row => row[columns[1]] || 0);

    return {
      type,
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: labels.map((_, index) => this.getColor(index, 0.8)),
          borderColor: labels.map((_, index) => this.getColor(index, 1)),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#e5e7eb' }
          }
        }
      }
    };
  }

  private static generateScatterChart(data: Record<string, any>[], columns: string[]): ChartConfig {
    const datasets = [{
      label: `${columns[0]} vs ${columns[1]}`,
      data: data.map(row => ({
        x: row[columns[0]] || 0,
        y: row[columns[1]] || 0
      })),
      backgroundColor: this.getColor(0, 0.6),
      borderColor: this.getColor(0, 1),
      borderWidth: 2
    }];

    return {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#e5e7eb' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          },
          y: {
            ticks: { color: '#9ca3af' },
            grid: { color: '#374151' }
          }
        }
      }
    };
  }

  private static getColor(index: number, alpha: number): string {
    const colors = [
      `rgba(59, 130, 246, ${alpha})`,   // blue
      `rgba(16, 185, 129, ${alpha})`,   // green
      `rgba(245, 158, 11, ${alpha})`,   // yellow
      `rgba(239, 68, 68, ${alpha})`,    // red
      `rgba(139, 92, 246, ${alpha})`,   // purple
      `rgba(236, 72, 153, ${alpha})`,   // pink
      `rgba(6, 182, 212, ${alpha})`,    // cyan
      `rgba(34, 197, 94, ${alpha})`     // emerald
    ];
    return colors[index % colors.length];
  }
}