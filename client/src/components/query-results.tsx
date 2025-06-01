import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';

const ROWS_PER_PAGE = 100;

export function QueryResults() {
  const { queryResults } = useDatabaseStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');

  if (!queryResults) {
    return (
      <div className="h-80 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <p>No query results to display</p>
          <p className="text-sm mt-1">Execute a query to see results here</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(queryResults.rows.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, queryResults.rows.length);
  const currentRows = queryResults.rows.slice(startIndex, endIndex);

  const exportResults = () => {
    const csvContent = [
      queryResults.columns.join(','),
      ...queryResults.rows.map(row => 
        queryResults.columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-results-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-80 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Results Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="font-semibold text-sm">Query Results</h3>
            <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
              <Badge variant="outline">
                {queryResults.rowCount} rows
              </Badge>
              <Badge variant="outline">
                {queryResults.executionTime}ms
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportResults}
              className="flex items-center text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Export CSV
            </Button>
            
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="px-2 py-1 text-xs"
              >
                Table
              </Button>
              <Button
                variant={viewMode === 'json' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('json')}
                className="px-2 py-1 text-xs"
              >
                JSON
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Content */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'table' ? (
          <Table>
            <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
              <TableRow>
                {queryResults.columns.map((column) => (
                  <TableHead
                    key={column}
                    className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700"
                  >
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.map((row, index) => (
                <TableRow
                  key={startIndex + index}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700"
                >
                  {queryResults.columns.map((column) => (
                    <TableCell
                      key={column}
                      className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
                    >
                      {row[column] === null || row[column] === undefined ? (
                        <span className="text-gray-400 italic">NULL</span>
                      ) : typeof row[column] === 'object' ? (
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
                          {JSON.stringify(row[column])}
                        </span>
                      ) : String(row[column]).length > 100 ? (
                        <span title={String(row[column])}>
                          {String(row[column]).substring(0, 100)}...
                        </span>
                      ) : (
                        String(row[column])
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto">
              {JSON.stringify(currentRows, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {startIndex + 1} to {endIndex} of {queryResults.rowCount} results
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-8 h-8 p-0 text-sm"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {totalPages > 5 && (
                  <>
                    <span className="text-gray-400">...</span>
                    <Button
                      variant={totalPages === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-8 h-8 p-0 text-sm"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
