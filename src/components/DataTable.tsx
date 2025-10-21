'use client';

interface DataTableProps {
  data: Record<string, any>[];
}

export default function DataTable({ data }: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No data to display
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const maxRows = 100; // Limit display for performance
  const displayData = data.slice(0, maxRows);

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="text-left">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayData.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column}>
                  {formatCellValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {data.length > maxRows && (
        <div className="mt-4 text-center text-sm text-gray-400">
          Showing first {maxRows} of {data.length} rows
        </div>
      )}
    </div>
  );
}

function formatCellValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'number') {
    // Format numbers with appropriate decimal places
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(2);
  }
  
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  
  return String(value);
}