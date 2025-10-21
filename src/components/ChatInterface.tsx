'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage, Dataset, QueryResult } from '@/types';
import { AIService } from '@/utils/aiService';
import { DataProcessor } from '@/utils/dataProcessor';
import DataTable from './DataTable';
import ChartVisualization from './ChartVisualization';

interface ChatInterfaceProps {
  dataset: Dataset;
}

export default function ChatInterface({ dataset }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'table' | 'chart'>('table');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      type: 'assistant',
      content: dataset.isDatabase
        ? `Connected to "${dataset.name}" successfully! You can now ask questions about your database. The AI will automatically determine which tables to query based on your questions. For example:\n\n• "Show me sales data from last month"\n• "What are the top performing products?"\n• "Count total customers by region"\n• "Show me recent transactions"`
        : `Dataset "${dataset.name}" loaded successfully! You can now ask questions about your data. For example:\n\n• "Show me the first 10 rows"\n• "What are the column names?"\n• "Count the total number of records"\n• "Show me records where [column] > [value]"`,
      timestamp: new Date()
    };
    setMessages([welcomeMessage]);
  }, [dataset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      let aiResponse;
      let queryResult: QueryResult | undefined;
      
      if (dataset.isDatabase) {
        // Handle database queries
        console.log('🔍 Processing database query:', inputValue.trim());
        
        const response = await fetch('/api/usdb/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: inputValue.trim()
          })
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Database query failed');
        }

        aiResponse = {
          query: result.query,
          explanation: result.explanation,
          chartSuggestion: result.chartSuggestion
        };

        queryResult = {
          data: result.results,
          columns: result.results.length > 0 ? Object.keys(result.results[0]) : [],
          rowCount: result.rowCount,
          executionTime: 0 // Database execution time not tracked separately
        };

        console.log('✅ Database query executed successfully:', queryResult);
        
      } else {
        // Handle CSV/Excel file queries (existing logic)
        aiResponse = await AIService.generateSQL(inputValue.trim(), dataset.schema);
        
        if (aiResponse.query) {
          const startTime = Date.now();
          // Use SQL engine directly instead of passing dataset.data
          const resultData = DataProcessor.executeQuery([], aiResponse.query);
          const executionTime = Date.now() - startTime;
          
          console.log('🔍 Query result data:', resultData);
          console.log('🔍 Result data length:', resultData.length);
          
          queryResult = {
            data: resultData,
            columns: resultData.length > 0 ? Object.keys(resultData[0]) : [],
            rowCount: resultData.length,
            executionTime
          };
          
          console.log('🔍 Query result object:', queryResult);
        }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: aiResponse.explanation,
        timestamp: new Date(),
        query: aiResponse.query,
        result: queryResult
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.type === 'user';
    
    return (
      <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && (
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
        )}
        
        <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
          <div className={`p-4 rounded-lg ${
            isUser 
              ? 'bg-blue-600 text-white ml-auto' 
              : 'bg-gray-800 text-gray-100'
          }`}>
            <div className="whitespace-pre-wrap">{message.content}</div>
            
            {message.query && (
              <div className="mt-3 p-3 bg-gray-900 rounded border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">Generated SQL:</div>
                <code className="text-sm text-green-400 font-mono">{message.query}</code>
              </div>
            )}
          </div>
          
          {message.result && message.result.data.length > 0 && (
            <div className="mt-4 bg-gray-900 rounded-lg border border-gray-800">
              <div className="flex border-b border-gray-800">
                <button
                  onClick={() => setActiveTab('table')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'table'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Table
                </button>
                <button
                  onClick={() => setActiveTab('chart')}
                  className={`px-4 py-2 text-sm font-medium ${
                    activeTab === 'chart'
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Chart
                </button>
              </div>
              
              <div className="p-4">
                {activeTab === 'table' ? (
                  <DataTable data={message.result.data} />
                ) : (
                  <ChartVisualization 
                    data={message.result.data} 
                    columns={message.result.columns}
                  />
                )}
              </div>
              
              <div className="px-4 py-2 border-t border-gray-800 text-xs text-gray-400">
                {message.result.rowCount} rows • {message.result.executionTime}ms
              </div>
            </div>
          )}
          
          <div className="text-xs text-gray-500 mt-1">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
        
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map(renderMessage)}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-gray-800 text-gray-100 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyzing your query...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask a question about your data..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}