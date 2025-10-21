'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Scatter } from 'react-chartjs-2';
import { AIService } from '@/utils/aiService';
import { ChartConfig } from '@/types';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface ChartVisualizationProps {
  data: Record<string, any>[];
  columns: string[];
}

export default function ChartVisualization({ data, columns }: ChartVisualizationProps) {
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie' | 'doughnut' | 'scatter'>('bar');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);

  useEffect(() => {
    if (data && data.length > 0 && columns && columns.length > 0) {
      // Auto-select first two columns by default
      const defaultColumns = columns.slice(0, 2);
      setSelectedColumns(defaultColumns);
      generateChart(chartType, defaultColumns);
    }
  }, [data, columns]);

  const generateChart = (type: typeof chartType, cols: string[]) => {
    if (!data || data.length === 0 || !cols || cols.length === 0) {
      setChartConfig(null);
      return;
    }

    const config = AIService.generateChartConfig(data, type, cols);
    setChartConfig(config);
  };

  const handleChartTypeChange = (newType: typeof chartType) => {
    setChartType(newType);
    generateChart(newType, selectedColumns);
  };

  const handleColumnChange = (column: string, checked: boolean) => {
    let newColumns: string[];
    
    if (checked) {
      newColumns = [...selectedColumns, column];
    } else {
      newColumns = selectedColumns.filter(col => col !== column);
    }
    
    // Limit to 5 columns for performance
    if (newColumns.length > 5) {
      newColumns = newColumns.slice(0, 5);
    }
    
    setSelectedColumns(newColumns);
    generateChart(chartType, newColumns);
  };

  const renderChart = () => {
    if (!chartConfig) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-400">
          No chart data available
        </div>
      );
    }

    const commonProps = {
      data: chartConfig.data,
      options: chartConfig.options,
      height: 300
    };

    switch (chartConfig.type) {
      case 'bar':
        return <Bar {...commonProps} />;
      case 'line':
        return <Line {...commonProps} />;
      case 'pie':
        return <Pie {...commonProps} />;
      case 'doughnut':
        return <Doughnut {...commonProps} />;
      case 'scatter':
        return <Scatter {...commonProps} />;
      default:
        return <Bar {...commonProps} />;
    }
  };

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No data available for visualization
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chart Type Selector */}
      <div className="flex flex-wrap gap-2">
        <span className="text-sm text-gray-400 mr-2">Chart Type:</span>
        {(['bar', 'line', 'pie', 'doughnut', 'scatter'] as const).map((type) => (
          <button
            key={type}
            onClick={() => handleChartTypeChange(type)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              chartType === type
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Column Selector */}
      <div className="space-y-2">
        <span className="text-sm text-gray-400">Columns to visualize:</span>
        <div className="flex flex-wrap gap-2">
          {columns.map((column) => (
            <label key={column} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedColumns.includes(column)}
                onChange={(e) => handleColumnChange(column, e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
              />
              <span className="text-gray-300">{column}</span>
            </label>
          ))}
        </div>
        {selectedColumns.length === 0 && (
          <p className="text-xs text-yellow-400">Select at least one column to display chart</p>
        )}
        {selectedColumns.length > 5 && (
          <p className="text-xs text-yellow-400">Maximum 5 columns can be selected</p>
        )}
      </div>

      {/* Chart Container */}
      <div className="chart-container">
        <div style={{ height: '300px' }}>
          {renderChart()}
        </div>
      </div>

      {/* Chart Info */}
      <div className="text-xs text-gray-400">
        Visualizing {selectedColumns.length} column(s) from {data.length} rows
      </div>
    </div>
  );
}