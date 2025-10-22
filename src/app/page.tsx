'use client';

import { useState } from 'react';
import { Dataset } from '@/types';
import Sidebar from '@/components/Sidebar';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import { SQLEngine } from '@/utils/sqlEngine';

export default function Home() {
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);
  const [isConnectingToDatabase, setIsConnectingToDatabase] = useState(false);

  const handleDatasetUploaded = (dataset: Dataset) => {
    setCurrentDataset(dataset);
  };

  const handleNewAnalysis = () => {
    setCurrentDataset(null);
  };

  const handleConnectToUSDB = async () => {
    setIsConnectingToDatabase(true);
    try {
      console.log('🔌 Connecting to USDB database...');
      
      const response = await fetch('/api/usdb/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to connect to database');
      }

      console.log(`✅ Successfully connected to database with ${result.tablesCount} tables`);

      // Create a database dataset
      const databaseDataset: Dataset = {
        id: 'usdb-' + Date.now(),
        name: 'USDB Database Connection',
        data: [], // No data preview for database connections
        schema: {
          tableName: 'database',
          columns: [] // Schema will be determined dynamically based on queries
        },
        uploadedAt: new Date(),
        isDatabase: true,
        connectionInfo: {
          connected: true,
          tablesCount: result.tablesCount,
          lastConnected: new Date()
        },
        tables: result.tables // Store the database tables with their schemas
      };

      setCurrentDataset(databaseDataset);
      console.log('Database connection established successfully');
      
    } catch (error) {
      console.error('❌ Failed to connect to database:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Show a more detailed error message
      if (errorMessage.includes('Deny Public Network Access')) {
        alert(`🚫 Database Connection Blocked\n\nThe Azure SQL Server has public network access disabled. This is a security setting that prevents connections from outside the Azure network.\n\nTo resolve this:\n1. Contact your database administrator\n2. Request to whitelist your IP address\n3. Or ask to enable public network access\n\nTechnical details: ${errorMessage}`);
      } else if (errorMessage.includes('authentication')) {
        alert(`🔐 Authentication Failed\n\nYour Azure Active Directory credentials don't have permission to access this database.\n\nPlease contact your database administrator to grant you the necessary permissions.\n\nTechnical details: ${errorMessage}`);
      } else {
        alert(`❌ Database Connection Failed\n\n${errorMessage}\n\nPlease check your network connection and try again. If the problem persists, contact your system administrator.`);
      }
    } finally {
      setIsConnectingToDatabase(false);
    }
  };

  const handleLoadDemo = async () => {
    try {
      // Load sample data into SQL engine
      await SQLEngine.loadSampleData();
      
      // Get schema and sample data from SQL engine
      const schema = SQLEngine.getTableSchema('dataset');
      const rowCount = SQLEngine.getRowCount('dataset');
      const sampleData = SQLEngine.executeQuery('SELECT * FROM dataset LIMIT 100');

      const demoDataset: Dataset = {
        id: 'demo-' + Date.now(),
        name: 'sample-automotive-data.csv',
        data: sampleData,
        schema: {
          tableName: 'dataset',
          columns: schema.map(col => ({
            name: col.name,
            type: col.type as 'TEXT' | 'INTEGER' | 'REAL' | 'BOOLEAN' | 'DATE',
            nullable: true
          }))
        },
        uploadedAt: new Date()
      };

      setCurrentDataset(demoDataset);
      console.log(`Loaded demo dataset with ${rowCount} rows into SQL engine`);
    } catch (error) {
      console.error('Failed to load demo data:', error);
      // Fallback to hardcoded data if SQL engine fails
      const demoData = [
        { name: 'John Smith', age: 28, department: 'Engineering', salary: 75000, hire_date: '2022-01-15', active: true },
        { name: 'Sarah Johnson', age: 32, department: 'Marketing', salary: 68000, hire_date: '2021-03-22', active: true },
        { name: 'Mike Davis', age: 45, department: 'Engineering', salary: 95000, hire_date: '2019-07-10', active: true },
        { name: 'Emily Brown', age: 29, department: 'Sales', salary: 62000, hire_date: '2022-05-18', active: true },
        { name: 'David Wilson', age: 38, department: 'Engineering', salary: 82000, hire_date: '2020-11-03', active: true },
        { name: 'Lisa Garcia', age: 26, department: 'Marketing', salary: 58000, hire_date: '2023-02-14', active: true },
        { name: 'James Miller', age: 41, department: 'Sales', salary: 71000, hire_date: '2020-08-25', active: true },
        { name: 'Anna Taylor', age: 33, department: 'Engineering', salary: 88000, hire_date: '2021-09-12', active: true },
        { name: 'Robert Anderson', age: 36, department: 'Marketing', salary: 65000, hire_date: '2021-12-08', active: true },
        { name: 'Jennifer Thomas', age: 31, department: 'Sales', salary: 69000, hire_date: '2022-07-30', active: true }
      ];

      const fallbackDataset: Dataset = {
        id: 'demo-' + Date.now(),
        name: 'sample-automotive-data.csv (fallback)',
        data: demoData,
        schema: {
          tableName: 'dataset',
          columns: [
            { name: 'name', type: 'TEXT', nullable: false },
            { name: 'age', type: 'INTEGER', nullable: false },
            { name: 'department', type: 'TEXT', nullable: false },
            { name: 'salary', type: 'INTEGER', nullable: false },
            { name: 'hire_date', type: 'DATE', nullable: false },
            { name: 'active', type: 'BOOLEAN', nullable: false }
          ]
        },
        uploadedAt: new Date()
      };

      setCurrentDataset(fallbackDataset);
    }
  };

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <Sidebar 
        currentDataset={currentDataset}
        onNewAnalysis={handleNewAnalysis}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {!currentDataset ? (
          /* Welcome/Upload Screen */
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-2xl mx-auto text-center">
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-white mb-4">
                  Welcome to DataChat AI
                </h1>
                <p className="text-xl text-gray-400 mb-8">
                  Upload your dataset and start asking questions in natural language. 
                  Our AI will convert your queries to SQL and provide instant insights.
                </p>
              </div>

              <div className="space-y-4">
                <FileUpload onDatasetUploaded={handleDatasetUploaded} />
                
                <div className="text-center">
                  <div className="text-sm text-gray-500 mb-2">or</div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleConnectToUSDB}
                      disabled={isConnectingToDatabase}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 text-sm border border-blue-500 flex items-center gap-2"
                    >
                      {isConnectingToDatabase ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3 3 3-3" />
                          </svg>
                          Connect to USDB Data
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleLoadDemo}
                      className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors duration-200 text-sm border border-gray-700"
                    >
                      Try Demo with Sample Data
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    📊 Smart Analysis
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Ask questions like "Show me top 10 customers by revenue" and get instant SQL queries with results.
                  </p>
                </div>

                <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    📈 Visual Insights
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Automatically generate charts and visualizations from your query results with Chart.js integration.
                  </p>
                </div>

                <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    🔄 Multiple Formats
                  </h3>
                  <p className="text-gray-400 text-sm">
                    Support for CSV, Excel files with automatic schema detection and caching for better performance.
                  </p>
                </div>
              </div>

              <div className="mt-8 text-sm text-gray-500">
                <p>Supported formats: CSV, Excel (.xlsx, .xls) • Max file size: 5MB</p>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Interface */
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="bg-gray-900 border-b border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    {currentDataset.isDatabase ? (
                      <>
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z" />
                        </svg>
                        Connected: {currentDataset.name}
                      </>
                    ) : (
                      <>Analyzing: {currentDataset.name}</>
                    )}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {currentDataset.isDatabase ? (
                      <>
                        {currentDataset.connectionInfo?.tablesCount} tables available • Database connection active
                        {currentDataset.connectionInfo?.lastConnected && (
                          <> • Connected at {currentDataset.connectionInfo.lastConnected.toLocaleTimeString()}</>
                        )}
                      </>
                    ) : (
                      <>{currentDataset.data.length.toLocaleString()} rows • {currentDataset.schema.columns.length} columns</>
                    )}
                  </p>
                </div>
                
                <button
                  onClick={handleNewAnalysis}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors duration-200 text-sm"
                >
                  {currentDataset.isDatabase ? 'Disconnect & Upload New' : 'Upload New Dataset'}
                </button>
              </div>
            </div>

            {/* Chat Interface */}
            <ChatInterface dataset={currentDataset} />
          </div>
        )}
      </div>
    </div>
  );
}
