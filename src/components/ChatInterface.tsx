'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Check, X } from 'lucide-react';
import { ChatMessage, Dataset, QueryResult, StreamingStep } from '@/types';
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
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const streamingMessageRef = useRef<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  useEffect(() => {
    // Add welcome message with predefined questions
    const initializeWelcomeMessage = () => {
      if (dataset.isDatabase && dataset.tables) {
        // Predefined questions for database
        const predefinedQuestions = [
          "How many dealers do we have?",
          "Show me all dealers",
          "What's the total inventory count?",
          "Show me recent listings",
          "How many vehicles were sold in October 2024?",
          "Which states have the most dealers?"
        ];
        setSuggestedQuestions(predefinedQuestions);
        
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          type: 'assistant',
          content: `Connected to "${dataset.name}" successfully! You can now ask questions about your database. The AI will automatically determine which tables to query based on your questions.\n\nHere are some questions you can ask:`,
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      } else {
        // Predefined questions for CSV/Excel files
        const predefinedQuestions = [
          "Show me the first 10 rows",
          "What are the column names?",
          "Count the total number of records",
          "Show me a summary of the data"
        ];
        setSuggestedQuestions(predefinedQuestions);
        
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          type: 'assistant',
          content: `Dataset "${dataset.name}" loaded successfully! You can now ask questions about your data.\n\nHere are some questions you can ask:`,
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    };
    
    initializeWelcomeMessage();
  }, [dataset]);

  const handleQuestionClick = (question: string) => {
    if (isLoading) return;
    setInputValue(question);
    // Auto-submit the question
    setTimeout(() => {
      inputRef.current?.form?.requestSubmit();
    }, 100);
  };

  // Helper functions for streaming steps
  const updateStreamingStep = (stepId: string, updates: Partial<StreamingStep>) => {
    console.log('🔄 updateStreamingStep called:', { stepId, updates });
    setStreamingMessage(prev => {
      if (!prev || !prev.streamingSteps) {
        console.log('⚠️ updateStreamingStep: No prev message or steps');
        return prev;
      }
      const updated = {
        ...prev,
        streamingSteps: prev.streamingSteps.map(step =>
          step.id === stepId ? { ...step, ...updates } : step
        )
      };
      streamingMessageRef.current = updated;  // Update ref
      console.log('✅ updateStreamingStep: Updated state', {
        stepId,
        totalSteps: updated.streamingSteps.length,
        updatedStep: updated.streamingSteps.find(s => s.id === stepId)
      });
      return updated;
    });
  };

  const addStreamingStep = (step: StreamingStep) => {
    console.log('➕ addStreamingStep called:', { stepId: step.id, message: step.message });
    setStreamingMessage(prev => {
      if (!prev) {
        console.log('⚠️ addStreamingStep: No prev message');
        return prev;
      }
      const updated = {
        ...prev,
        streamingSteps: [...(prev.streamingSteps || []), step]
      };
      streamingMessageRef.current = updated;  // Update ref
      console.log('✅ addStreamingStep: Updated state', {
        totalSteps: updated.streamingSteps.length,
        allSteps: updated.streamingSteps.map(s => ({ id: s.id, status: s.status, message: s.message }))
      });
      return updated;
    });
  };

  const generateResultSummary = (rowCount: number, columns: string[]): string => {
    if (rowCount === 0) return "No results found for your query.";
    if (rowCount === 1) return `Found 1 result with ${columns.length} column${columns.length !== 1 ? 's' : ''}.`;
    
    const columnPreview = columns.length > 3
      ? `${columns.slice(0, 3).join(', ')}...`
      : columns.join(', ');
    
    return `Found ${rowCount} result${rowCount !== 1 ? 's' : ''} across ${columns.length} column${columns.length !== 1 ? 's' : ''}: ${columnPreview}`;
  };

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

    // Initialize streaming message
    const streamingMsg: ChatMessage = {
      id: 'streaming-' + Date.now(),
      type: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      streamingSteps: [
        {
          id: '1',
          status: 'in-progress',
          message: '🔍 Analyzing your question...',
          timestamp: new Date()
        }
      ]
    };
    setStreamingMessage(streamingMsg);
    streamingMessageRef.current = streamingMsg;  // Store in ref

    try {
      let aiResponse;
      let queryResult: QueryResult | undefined;
      
      // Small delay to show the analyzing step
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (dataset.isDatabase) {
        // Step 1: Complete analyzing
        updateStreamingStep('1', { status: 'complete' });
        
        // Step 2: Generating SQL
        addStreamingStep({
          id: '2',
          status: 'in-progress',
          message: '🤖 Generating SQL query...',
          timestamp: new Date()
        });

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

        console.log('📦 API Response received:', {
          success: result.success,
          hasQuery: !!result.query,
          hasResults: !!result.results,
          rowCount: result.rowCount
        });

        if (!result.success) {
          updateStreamingStep('2', { status: 'error' });
          addStreamingStep({
            id: 'error',
            status: 'error',
            message: `❌ Error: ${result.error}`,
            timestamp: new Date()
          });
          throw new Error(result.error || 'Database query failed');
        }

        // Step 2: Complete - SQL Generated (API already generated and executed)
        updateStreamingStep('2', { status: 'complete' });
        
        console.log('✅ Step 2 completed - SQL generated');
        
        // Step 3: Show the generated SQL
        addStreamingStep({
          id: '3',
          status: 'complete',
          message: '✅ SQL Generated',
          timestamp: new Date(),
          data: { sql: result.query }
        });

        console.log('✅ Step 3 added - Showing SQL:', result.query);

        // Delay to let user see the SQL query
        await new Promise(resolve => setTimeout(resolve, 800));

        // Step 4: Processing results (execution already happened on backend)
        addStreamingStep({
          id: '4',
          status: 'in-progress',
          message: '⚡ Processing results...',
          timestamp: new Date()
        });

        console.log('✅ Step 4 added - Processing results');

        // Small delay to show processing step
        await new Promise(resolve => setTimeout(resolve, 300));

        aiResponse = {
          query: result.query,
          explanation: result.explanation,
          chartSuggestion: result.chartSuggestion
        };

        queryResult = {
          data: result.results,
          columns: result.results.length > 0 ? Object.keys(result.results[0]) : [],
          rowCount: result.rowCount,
          executionTime: 0
        };

        // Step 5: Query completed
        updateStreamingStep('4', { status: 'complete' });
        const summary = generateResultSummary(queryResult.rowCount, queryResult.columns);
        addStreamingStep({
          id: '5',
          status: 'complete',
          message: `✅ Query completed! ${summary}`,
          timestamp: new Date()
        });

        console.log('✅ Step 5 added - Query completed:', { rowCount: queryResult.rowCount, columns: queryResult.columns.length });
        console.log('✅ Database query executed successfully:', queryResult);
        
      } else {
        // Handle CSV/Excel file queries with streaming
        updateStreamingStep('1', { status: 'complete' });
        
        addStreamingStep({
          id: '2',
          status: 'in-progress',
          message: '🤖 Generating SQL query...',
          timestamp: new Date()
        });

        aiResponse = await AIService.generateSQL(inputValue.trim(), dataset.schema);
        
        updateStreamingStep('2', { status: 'complete' });
        
        if (aiResponse.query) {
          addStreamingStep({
            id: '3',
            status: 'complete',
            message: '✅ SQL Generated',
            timestamp: new Date(),
            data: { sql: aiResponse.query }
          });

          // Delay to let user see the SQL query before execution starts
          await new Promise(resolve => setTimeout(resolve, 800));

          addStreamingStep({
            id: '4',
            status: 'in-progress',
            message: '⚡ Executing query...',
            timestamp: new Date()
          });

          const startTime = Date.now();
          const resultData = DataProcessor.executeQuery([], aiResponse.query);
          const executionTime = Date.now() - startTime;
          
          queryResult = {
            data: resultData,
            columns: resultData.length > 0 ? Object.keys(resultData[0]) : [],
            rowCount: resultData.length,
            executionTime
          };

          updateStreamingStep('4', { status: 'complete' });
          const summary = generateResultSummary(queryResult.rowCount, queryResult.columns);
          addStreamingStep({
            id: '5',
            status: 'complete',
            message: `✅ Query completed! ${summary}`,
            timestamp: new Date()
          });
          
          console.log('🔍 Query result object:', queryResult);
        }
      }

      // Small delay before showing final result
      await new Promise(resolve => setTimeout(resolve, 300));

      // ✅ Use the ref which has all the steps
      const currentStreamingMessage = streamingMessageRef.current;

      if (!currentStreamingMessage) {
        console.error('❌ streamingMessage is null, cannot create completed message');
        setIsLoading(false);
        return;
      }

      // Keep streaming steps and add final content to the same message
      const completedMessage: ChatMessage = {
        ...currentStreamingMessage,  // Now has all 5 steps!
        isStreaming: false,
        content: aiResponse.explanation,
        query: aiResponse.query,
        result: queryResult,
        timestamp: currentStreamingMessage.timestamp || new Date()
      };

      // Add to messages and clear streaming in separate operations
      // React will batch these updates properly
      setMessages(prev => [...prev, completedMessage]);
      setStreamingMessage(null);
      
    } catch (error) {
      // Check if streamingMessage exists before updating it
      if (streamingMessage) {
        setStreamingMessage(prev => {
          if (prev) {
            return {
              ...prev,
              streamingSteps: [
                ...(prev.streamingSteps || []),
                {
                  id: 'error',
                  status: 'error',
                  message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  timestamp: new Date()
                }
              ]
            };
          }
          return prev;
        });
        
        // Wait a bit then clear streaming and show error message
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setStreamingMessage(null);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStreamingSteps = (steps: StreamingStep[]) => {
    return (
      <div className="space-y-2 mt-3">
        {steps.map(step => (
          <div key={step.id} className="flex items-start gap-2 text-sm">
            <div className="flex-shrink-0 mt-0.5">
              {step.status === 'in-progress' && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
              {step.status === 'complete' && <Check className="h-3 w-3 text-green-400" />}
              {step.status === 'error' && <X className="h-3 w-3 text-red-400" />}
            </div>
            <div className="flex-1">
              <span className={step.status === 'complete' ? 'text-gray-400' : step.status === 'error' ? 'text-red-400' : 'text-gray-200'}>
                {step.message}
              </span>
              {step.data?.sql && (
                <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-700">
                  <code className="text-xs text-green-400 font-mono block whitespace-pre-wrap break-words">{step.data.sql}</code>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    // Add null check at the start
    if (!message) {
      console.error('renderMessage called with null message');
      return null;
    }
    
    const isUser = message.type === 'user';
    const isWelcomeMessage = message.id === 'welcome';
    
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
            {/* Show thinking process for completed messages with streaming steps */}
            {!message.isStreaming && message.streamingSteps && message.streamingSteps.length > 0 && (
              <details className="mb-4" open>
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-gray-300 mb-2 select-none">
                  🧠 Thinking Process ({message.streamingSteps.length} steps)
                </summary>
                <div className="space-y-2 pl-4 border-l-2 border-gray-700 mt-2">
                  {message.streamingSteps.map(step => (
                    <div key={step.id} className="flex items-start gap-2 text-sm">
                      <div className="flex-shrink-0 mt-0.5">
                        {step.status === 'complete' && <Check className="h-3 w-3 text-green-400" />}
                        {step.status === 'error' && <X className="h-3 w-3 text-red-400" />}
                      </div>
                      <div className="flex-1">
                        <span className="text-gray-400">{step.message}</span>
                        {step.data?.sql && (
                          <div className="mt-1 p-3 bg-gray-900 rounded border border-gray-700">
                            <code className="text-xs text-green-400 font-mono block whitespace-pre-wrap break-words">
                              {step.data.sql}
                            </code>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
            
            {/* Show streaming steps for in-progress messages */}
            {message.isStreaming && message.streamingSteps && renderStreamingSteps(message.streamingSteps)}
            
            {/* Show final content */}
            {message.content && !message.streamingSteps && <div className="whitespace-pre-wrap">{message.content}</div>}
            
            {isWelcomeMessage && suggestedQuestions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuestionClick(question)}
                    disabled={isLoading}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-gray-200 text-sm rounded-full transition-colors duration-200 border border-gray-600 hover:border-blue-500"
                  >
                    {question}
                  </button>
                ))}
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
            {message.timestamp?.toLocaleTimeString()}
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
        {messages.filter(msg => msg !== null).map(renderMessage)}
        
        {streamingMessage && streamingMessage.isStreaming && renderMessage(streamingMessage)}
        
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