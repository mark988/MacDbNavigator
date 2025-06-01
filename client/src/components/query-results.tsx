import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Download, ChevronLeft, ChevronRight, Edit2, Check, X } from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const ROWS_PER_PAGE = 50;

interface SingleQueryResultProps {
  queryResult: any;
  statement: string;
}

function SingleQueryResult({ queryResult, statement }: SingleQueryResultProps) {
  const { currentPage, activeConnectionId, queryHistory } = useDatabaseStore();
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; column: string } | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [pendingChanges, setPendingChanges] = useState<Map<string, any>>(new Map());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get the last query to determine the correct connection ID for updates
  const lastQuery = queryHistory.sort((a, b) => b.id - a.id)[0];

  const totalPages = Math.ceil(queryResult.rows.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, queryResult.rows.length);
  const currentRows = queryResult.rows.slice(startIndex, endIndex);

  // Check if this is a table query (simple SELECT from a single table)
  const isTableQuery = statement.trim().toLowerCase().match(/^select\s+.+\s+from\s+(\w+)(\s|$|;)/);
  const tableName = isTableQuery ? isTableQuery[1] : null;

  const startEditing = (rowIndex: number, column: string, currentValue: any) => {
    setEditingCell({ rowIndex, column });
    setEditingValue(currentValue === null ? '' : String(currentValue));
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const saveEdit = () => {
    if (!editingCell) return;
    
    const changeKey = `${editingCell.rowIndex}-${editingCell.column}`;
    const newChanges = new Map(pendingChanges);
    newChanges.set(changeKey, {
      rowIndex: editingCell.rowIndex,
      column: editingCell.column,
      oldValue: currentRows[editingCell.rowIndex][editingCell.column],
      newValue: editingValue
    });
    setPendingChanges(newChanges);
    
    // Update the display data
    currentRows[editingCell.rowIndex][editingCell.column] = editingValue;
    
    cancelEditing();
  };

  const saveChangesMutation = useMutation({
    mutationFn: async () => {
      if (!tableName || pendingChanges.size === 0) {
        throw new Error('Cannot save changes: missing table name or connection');
      }

      // Use the connection ID from the last query instead of activeConnectionId
      const queryConnectionId = lastQuery?.connectionId || activeConnectionId;
      const changes = Array.from(pendingChanges.values());
      
      // Extract database name from the query if available
      const queryMatch = lastQuery?.query.match(/from\s+(\w+)\.(\w+)/i);
      const databaseName = queryMatch ? queryMatch[1] : null;
      
      const response = await fetch(`/api/connections/${queryConnectionId}/table/${tableName}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          changes,
          originalData: currentRows,
          database: databaseName
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      return response.json();
    },
    onSuccess: () => {
      setPendingChanges(new Map());
      toast({
        title: "Changes saved",
        description: "Table data has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const saveAllChanges = () => {
    saveChangesMutation.mutate();
  };

  const discardChanges = () => {
    setPendingChanges(new Map());
    // Refresh the query to restore original data
    window.location.reload();
  };

  const exportResults = () => {
    const csvContent = [
      queryResult.columns.join(','),
      ...queryResult.rows.map((row: any) => 
        queryResult.columns.map((col: string) => {
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
    <div className="h-64 flex flex-col border-t border-gray-200 dark:border-gray-700">
      {/* Results Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs text-gray-600 dark:text-gray-400">
              <Badge variant="outline">
                {queryResult.rowCount} rows
              </Badge>
              <Badge variant="outline">
                {queryResult.executionTime}ms
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {pendingChanges.size > 0 && tableName && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={saveAllChanges}
                  disabled={saveChangesMutation.isPending}
                  className="flex items-center text-xs bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-3 h-3 mr-1" />
                  Save ({pendingChanges.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={discardChanges}
                  className="flex items-center text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Discard
                </Button>
                <div className="border-l border-gray-300 dark:border-gray-600 h-6 mx-2"></div>
              </>
            )}
            
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
      {queryResult.rows.length === 0 ? (
        <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm flex-shrink-0">
          No data found
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col border-x border-gray-200 dark:border-gray-700">
          {viewMode === 'table' ? (
            <>
              {/* Fixed Header */}
              <div className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-500 flex-shrink-0">
                <div className="flex">
                  {queryResult.columns.map((column: string) => (
                    <div
                      key={column}
                      className="px-3 py-2 font-medium text-xs text-gray-800 dark:text-gray-200 whitespace-nowrap min-w-32 flex-1 border-r border-gray-200 dark:border-gray-600 last:border-r-0 uppercase tracking-wider"
                    >
                      {column}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Scrollable Body */}
              <div className="flex-1 overflow-auto">
                <div>
                  {currentRows.map((row: any, index: number) => (
                    <div
                      key={startIndex + index}
                      className="hover:bg-blue-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex transition-colors duration-150 group"
                    >
                      {queryResult.columns.map((column: string) => {
                        const cellKey = `${index}-${column}`;
                        const isEditing = editingCell?.rowIndex === index && editingCell?.column === column;
                        const hasChange = pendingChanges.has(cellKey);
                        
                        return (
                          <div
                            key={column}
                            className={`px-3 py-1.5 text-sm whitespace-nowrap min-w-32 flex-1 border-r border-gray-100 dark:border-gray-600 last:border-r-0 font-mono relative ${
                              hasChange ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''
                            }`}
                          >
                            {isEditing ? (
                              <div className="flex items-center space-x-1">
                                <Input
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  className="h-6 text-xs font-mono border-blue-400 focus:border-blue-500"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  onClick={saveEdit}
                                  className="h-6 w-6 p-0"
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditing}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className="flex items-center justify-between group-hover:bg-transparent"
                                onClick={() => tableName && startEditing(index, column, row[column])}
                              >
                                <span className={`${tableName ? 'cursor-pointer' : ''} text-gray-700 dark:text-gray-200`}>
                                  {row[column] === null || row[column] === undefined ? (
                                    <span className="text-gray-400 italic font-sans">NULL</span>
                                  ) : typeof row[column] === 'object' ? (
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400">
                                      {JSON.stringify(row[column])}
                                    </span>
                                  ) : String(row[column]).length > 100 ? (
                                    <span title={String(row[column])}>
                                      {String(row[column]).substring(0, 100)}...
                                    </span>
                                  ) : (
                                    String(row[column])
                                  )}
                                </span>
                                {tableName && (
                                  <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                                )}
                              </div>
                            )}
                            {hasChange && (
                              <div className="absolute top-0 right-0 w-2 h-2 bg-orange-400 rounded-full transform translate-x-1 -translate-y-1"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-4">
              <pre className="text-sm font-mono bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto">
                {JSON.stringify(currentRows, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function QueryResults() {
  const { queryResults, queryHistory, activeConnectionId } = useDatabaseStore();

  if (!queryResults) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
        <p>Run a query to see results</p>
      </div>
    );
  }

  // Handle multi-statement results
  if (queryResults.multiStatementResults && queryResults.multiStatementResults.length > 0) {
    return (
      <div className="h-64 flex flex-col border-t border-gray-200 dark:border-gray-700">
        <Tabs defaultValue="statement-0" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start border-b border-gray-200 dark:border-gray-700 bg-transparent h-auto p-0 flex-shrink-0">
            {queryResults.multiStatementResults.map((statementResult, index) => (
              <TabsTrigger
                key={`statement-${index}`}
                value={`statement-${index}`}
                className="px-4 py-2 border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent rounded-none"
              >
                Statement {index + 1} ({statementResult.result.rowCount} rows)
              </TabsTrigger>
            ))}
          </TabsList>
          
          {queryResults.multiStatementResults.map((statementResult, index) => (
            <TabsContent
              key={`statement-${index}`}
              value={`statement-${index}`}
              className="flex-1 flex flex-col mt-0 min-h-0"
            >
              <SingleQueryResult
                queryResult={statementResult.result}
                statement={statementResult.statement}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // Handle single statement result - get the most recent query regardless of connection ID
  // since the user just executed it on the current connection
  const lastQuery = queryHistory
    .sort((a, b) => b.id - a.id)[0]; // Get the most recent query
  

  
  return <SingleQueryResult queryResult={queryResults} statement={lastQuery?.query || ""} />;
}

// Pagination component that will be placed at the bottom of the page
export function QueryPagination() {
  const { queryResults, currentPage, setCurrentPage } = useDatabaseStore();
  
  if (!queryResults) {
    return null;
  }

  // Handle both single and multi-statement results
  let totalRows = 0;
  if (queryResults.multiStatementResults && queryResults.multiStatementResults.length > 0) {
    totalRows = queryResults.multiStatementResults.reduce((sum, result) => sum + result.result.rowCount, 0);
  } else {
    totalRows = queryResults.rowCount;
  }

  if (totalRows === 0) {
    return null;
  }

  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, totalRows);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600 dark:text-gray-400">
          Showing {startIndex + 1} to {endIndex} of {totalRows} results
        </div>
        
        <div className="flex items-center space-x-4">
          {totalPages > 1 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
          )}
          
          {totalPages > 1 && (
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage <= 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}