'use client';

import { useState, useRef } from 'react';
import { Upload, File, AlertCircle } from 'lucide-react';
import { Dataset } from '@/types';
import { DataProcessor, cacheSchema } from '@/utils/dataProcessor';

interface FileUploadProps {
  onDatasetUploaded: (dataset: Dataset) => void;
}

export default function FileUpload({ onDatasetUploaded }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File size must be less than 5MB');
      return;
    }

    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      setError('Please upload a CSV or Excel file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const dataset = await DataProcessor.processFile(file);
      cacheSchema(dataset.schema);
      onDatasetUploaded(dataset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      <button
        onClick={handleButtonClick}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 border border-blue-500"
      >
        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Processing...</span>
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            <span>Upload Dataset</span>
          </>
        )}
      </button>

      <div className="mt-3 text-center">
        <p className="text-sm text-gray-400">
          Supports CSV, Excel files (max 5MB)
        </p>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}