import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useDatabaseStore } from '@/lib/database-store';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, X, Download, Edit3 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const ROWS_PER_PAGE = 30;

interface SingleQueryResultProps {
  queryResult: any;
  statement: string;
}

function SingleQueryResult({ queryResult, statement }: SingleQueryResultProps) {
  const { currentPage, setCurrentPage, activeConnectionId, queryHistory, tabs, activeTabId } = useDatabaseStore();
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

  // Extract table name from statement
  const tableName = statement.match(/(?:from|into|update)\s+(\w+)/i)?.[1];

  const handleCellClick = (rowIndex: number, column: string, value: any) => {
    setEditingCell({ rowIndex, column });
    setEditingValue(value?.toString() || '');
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const cellKey = `${editingCell.rowIndex}-${editingCell.column}`;
      const originalValue = currentRows[editingCell.rowIndex][editingCell.column];
      
      if (editingValue !== originalValue?.toString()) {
        const newChanges = new Map(pendingChanges);
        newChanges.set(cellKey, editingValue);
        setPendingChanges(newChanges);
      }
    }
    setEditingCell(null);
    setEditingValue('');
  };

  const updateMutation = useMutation({
    mutationFn: async (data: {
      changes: Array<{
        id: string;
        [key: string]: any;
      }>;
      originalData: Array<any>;
      database: string | null;
      schema: string | null;
      fullQuery: string;
    }) => {
      if (!activeConnectionId || !tableName) {
        throw new Error('No active connection or table name');
      }

      const response = await apiRequest({
        method: 'POST',
        url: `/api/connections/${activeConnectionId}/table/${tableName}/update`,
        body: data,
      });

      return response;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Data updated successfully",
      });
      setPendingChanges(new Map());
      queryClient.invalidateQueries({ queryKey: ['/api/query-history'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update data",
        variant: "destructive",
      });
    },
  });

  const saveChanges = () => {
    if (pendingChanges.size === 0 || !tableName) return;

    const changes = Array.from(pendingChanges.entries()).map(([cellKey, value]) => {
      const [rowIndexStr, column] = cellKey.split('-');
      const rowIndex = parseInt(rowIndexStr);
      const originalRow = currentRows[rowIndex];
      
      return {
        id: originalRow.id?.toString() || '',
        [column]: value,
      };
    });

    const activeTab = tabs.find(tab => tab.id === activeTabId);
    updateMutation.mutate({
      changes,
      originalData: currentRows,
      database: activeTab?.databaseName || null,
      schema: null,
      fullQuery: statement,
    });
  };

  const discardChanges = () => {
    setPendingChanges(new Map());
    setEditingCell(null);
    setEditingValue('');
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
    <div className="flex flex-col h-full border-t border-gray-200 dark:border-gray-700 -mt-3">
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
                  onClick={saveChanges}
                  disabled={updateMutation.isPending}
                  className="flex items-center text-xs h-8"
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save ({pendingChanges.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={discardChanges}
                  className="flex items-center text-xs h-8"
                >
                  <X className="w-3 h-3 mr-1" />
                  Discard
                </Button>
                <div className="border-l border-gray-300 dark:border-gray-600 h-6 mx-2"></div>
              </>
            )}
            
            <button
              onClick={exportResults}
              className="flex items-center text-xs px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Download className="w-3 h-3 mr-1" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Results Content */}
      {queryResult.rows.length === 0 ? (
        <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
          No data found
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Table Container */}
          <div className="flex-1 border-x border-gray-200 dark:border-gray-700 flex flex-col min-h-0">
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
            <div className="flex-1 overflow-auto min-h-0">
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
                          className="relative px-3 py-1 text-xs text-gray-900 dark:text-gray-100 whitespace-nowrap min-w-32 flex-1 border-r border-gray-100 dark:border-gray-700 last:border-r-0 cursor-text overflow-hidden"
                          onClick={() => tableName && handleCellClick(index, column, row[column])}
                        >
                          {isEditing && tableName ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={handleCellBlur}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleCellBlur();
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                  setEditingValue('');
                                }
                              }}
                              className="w-full bg-white dark:bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-xs focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <div className={`flex items-center justify-between h-full ${hasChange ? 'bg-yellow-100 dark:bg-yellow-900/30' : ''}`}>
                              <span className="truncate">
                                {hasChange ? pendingChanges.get(cellKey) : (row[column] ?? '')}
                              </span>
                              {tableName && (
                                <Edit3 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Pagination Bar - Fixed at bottom */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing {startIndex + 1} to {endIndex} of {queryResult.rows.length} results
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function QueryResults() {
  const { queryResults, queryHistory, activeConnectionId } = useDatabaseStore();

  if (!queryResults) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 min-h-0 py-4">
        <p>Run a query to see results</p>
      </div>
    );
  }

  // Handle multi-statement results
  if (queryResults.multiStatementResults && queryResults.multiStatementResults.length > 0) {
    return (
      <div className="flex flex-col flex-1 border-t border-gray-200 dark:border-gray-700">
        <Tabs defaultValue="statement-0" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start border-b border-gray-200 dark:border-gray-700 bg-transparent h-auto p-0 flex-shrink-0">
            {queryResults.multiStatementResults.map((result, index) => (
              <TabsTrigger
                key={index}
                value={`statement-${index}`}
                className="px-4 py-2 text-xs border-b-2 border-transparent data-[state=active]:border-blue-500 bg-transparent rounded-none"
              >
                Statement {index + 1} ({result.result.rowCount} rows)
              </TabsTrigger>
            ))}
          </TabsList>
          {queryResults.multiStatementResults.map((result, index) => (
            <TabsContent key={index} value={`statement-${index}`} className="flex-1 m-0 p-0">
              <SingleQueryResult queryResult={result.result} statement={result.statement} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // Single query result
  return <SingleQueryResult queryResult={queryResults} statement={queryHistory[queryHistory.length - 1]?.query || ''} />;
}

export function QueryPagination() {
  // This component is no longer needed as pagination is now built into SingleQueryResult
  return null;
}