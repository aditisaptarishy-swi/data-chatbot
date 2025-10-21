'use client';

import { useState } from 'react';
import { Dataset } from '@/types';
import Sidebar from '@/components/Sidebar';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import { SQLEngine } from '@/utils/sqlEngine';

export default function Home() {
  const [currentDataset, setCurrentDataset] = useState<Dataset | null>(null);

  const handleDatasetUploaded = (dataset: Dataset) => {
    setCurrentDataset(dataset);
  };

  const handleNewAnalysis = () => {
    setCurrentDataset(null);
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
        name: 'sample-employees.csv',
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
        name: 'sample-employees.csv',
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
                  <button
                    onClick={handleLoadDemo}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors duration-200 text-sm border border-gray-700"
                  >
                    Try Demo with Sample Data
                  </button>
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
                  <h2 className="text-xl font-semibold text-white">
                    Analyzing: {currentDataset.name}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {currentDataset.data.length.toLocaleString()} rows • {currentDataset.schema.columns.length} columns
                  </p>
                </div>
                
                <button
                  onClick={handleNewAnalysis}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors duration-200 text-sm"
                >
                  Upload New Dataset
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
