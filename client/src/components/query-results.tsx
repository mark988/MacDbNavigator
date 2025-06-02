import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryClient } from '@tanstack/react-query';
import { useDatabaseStore } from '@/lib/database-store';
import { Download, Save, X, Edit2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    setEditingValue(String(value || ''));
  };

  const handleCellBlur = () => {
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (editingCell) {
        const cellKey = `${editingCell.rowIndex}-${editingCell.column}`;
        const newChanges = new Map(pendingChanges);
        newChanges.set(cellKey, editingValue);
        setPendingChanges(newChanges);
      }
      setEditingCell(null);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const saveChanges = async () => {
    if (pendingChanges.size === 0) return;

    try {
      // Use the connection ID from the last query instead of activeConnectionId
      const queryConnectionId = lastQuery?.connectionId || activeConnectionId;
      
      // Convert pendingChanges to the correct format expected by the backend
      const originalData = queryResult?.rows || [];
      const changes = Array.from(pendingChanges.entries()).map(([cellKey, newValue]) => {
        const [rowIndexStr, column] = cellKey.split('-');
        const rowIndex = parseInt(rowIndexStr);
        const originalRow = originalData[rowIndex];
        return {
          rowIndex,
          column,
          newValue,
          oldValue: originalRow ? originalRow[column] : null
        };
      });
      
      // Get the current active tab to extract database information
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      const targetDatabase = activeTab?.databaseName;
      
      console.log('Save operation database info:', {
        tableName,
        targetDatabase,
        activeTab: activeTab?.title,
        queryConnectionId
      });
      
      const response = await fetch(`/api/connections/${queryConnectionId}/table/${tableName}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          changes,
          originalData: originalData,
          database: targetDatabase,
          fullQuery: lastQuery?.query
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      setPendingChanges(new Map());
      toast({
        title: "Success",
        description: `Saved ${changes.length} change(s) to ${tableName}`,
      });

      // Refresh the query results
      queryClient.invalidateQueries({ queryKey: ['/api/query-history'] });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes to database",
      });
    }
  };

  const discardChanges = () => {
    setPendingChanges(new Map());
    toast({
      title: "Changes discarded",
      description: "All pending changes have been discarded",
    });
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
    <div className="flex flex-col flex-1 border-t border-gray-200 dark:border-gray-700 -mt-1">
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
                  className="flex items-center text-xs bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-3 h-3 mr-1" />
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
          </div>
        </div>
      </div>

      {/* Results Content */}
      {queryResult.rows.length === 0 ? (
        <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm flex-shrink-0">
          No data found
        </div>
      ) : (
        <div className="border-x border-gray-200 dark:border-gray-700">
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
          <div className="overflow-auto" style={{height: '250px'}}>
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
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleCellBlur()}
                            onKeyDown={(e) => handleKeyDown(e)}
                            className="w-full bg-white dark:bg-gray-900 border border-blue-500 rounded px-1 py-0 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className={`truncate ${hasChange ? 'bg-yellow-100 dark:bg-yellow-900 px-1 rounded' : ''}`}>
                              {hasChange ? (
                                <span className="text-orange-600 dark:text-orange-400">
                                  {pendingChanges.get(cellKey)}
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
          
          {/* Pagination Bar */}
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
                Page {currentPage} of {Math.ceil(queryResult.rows.length / ROWS_PER_PAGE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(Math.ceil(queryResult.rows.length / ROWS_PER_PAGE), currentPage + 1))}
                disabled={currentPage === Math.ceil(queryResult.rows.length / ROWS_PER_PAGE)}
              >
                Next
              </Button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1} to {Math.min(currentPage * ROWS_PER_PAGE, queryResult.rows.length)} of {queryResult.rows.length} results
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
            <TabsContent key={index} value={`statement-${index}`} className="flex-1 min-h-0 mt-0">
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
  const { queryResults, currentPage, setCurrentPage } = useDatabaseStore();

  if (!queryResults || queryResults.rows.length === 0) {
    return null;
  }

  const totalPages = Math.ceil(queryResults.rows.length / ROWS_PER_PAGE);

  return (
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
        Showing {((currentPage - 1) * ROWS_PER_PAGE) + 1} to {Math.min(currentPage * ROWS_PER_PAGE, queryResults.rows.length)} of {queryResults.rows.length} results
      </div>
    </div>
  );
}