'use client';

import { useState } from 'react';
import { Database, MessageSquare, Plus, Trash2, FileText } from 'lucide-react';
import { Dataset, AnalysisSession } from '@/types';

interface SidebarProps {
  currentDataset: Dataset | null;
  onNewAnalysis: () => void;
  onDatasetSelect?: (dataset: Dataset) => void;
}

export default function Sidebar({ currentDataset, onNewAnalysis, onDatasetSelect }: SidebarProps) {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDatasetSize = (dataset: Dataset): number => {
    return JSON.stringify(dataset.data).length;
  };

  return (
    <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-semibold text-white">DataChat AI</h1>
        </div>
        
        <button
          onClick={onNewAnalysis}
          className="w-full flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
        >
          <Plus className="h-4 w-4" />
          New Analysis
        </button>
      </div>

      {/* Current Dataset Info */}
      {currentDataset && (
        <div className="p-4 border-b border-gray-800">
          <div className="text-sm text-gray-400 mb-2">Current Dataset</div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-blue-400" />
              <span className="text-white font-medium truncate">{currentDataset.name}</span>
            </div>
            
            <div className="space-y-1 text-xs text-gray-400">
              <div>Rows: {currentDataset.data.length.toLocaleString()}</div>
              <div>Columns: {currentDataset.schema.columns.length}</div>
              <div>Size: {formatFileSize(getDatasetSize(currentDataset))}</div>
              <div>Uploaded: {currentDataset.uploadedAt.toLocaleDateString()}</div>
            </div>
            
            <div className="mt-3">
              <div className="text-xs text-gray-400 mb-1">Schema:</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {currentDataset.schema.columns.map((col, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-gray-300 truncate">{col.name}</span>
                    <span className="text-gray-500 ml-2">{col.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analysis History */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="text-sm text-gray-400 mb-3">Recent Analyses</div>
          
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No analysis sessions yet</p>
              <p className="text-xs mt-1">Upload a dataset to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition-colors duration-200 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {session.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {session.messages.length} messages
                      </div>
                      <div className="text-xs text-gray-500">
                        {session.updatedAt.toLocaleDateString()}
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessions(prev => prev.filter(s => s.id !== session.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all duration-200"
                    >
                      <Trash2 className="h-3 w-3 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 text-center">
          <p>Powered by AI • Natural Language to SQL</p>
          <p className="mt-1">Upload CSV or Excel files to analyze</p>
        </div>
      </div>
    </div>
  );
}