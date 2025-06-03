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

  const lastQuery = queryHistory.sort((a, b) => b.id - a.id)[0];
  const totalPages = Math.ceil(queryResult.rows.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = Math.min(startIndex + ROWS_PER_PAGE, queryResult.rows.length);
  const currentRows = queryResult.rows.slice(startIndex, endIndex);
  const tableName = statement.match(/(?:from|into|update)\s+(\w+)/i)?.[1];

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/connections/${data.connectionId}/table/${data.tableName}/update`, data);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
      setPendingChanges(new Map());
      queryClient.invalidateQueries({ queryKey: ['/api/query-history'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCellClick = (rowIndex: number, column: string, value: any) => {
    setEditingCell({ rowIndex, column });
    setEditingValue(value?.toString() || '');
  };

  const handleCellBlur = () => {
    if (editingCell) {
      const cellKey = `${editingCell.rowIndex}-${editingCell.column}`;
      const originalValue = currentRows[editingCell.rowIndex][editingCell.column];
      
      if (editingValue !== (originalValue?.toString() || '')) {
        const newChanges = new Map(pendingChanges);
        newChanges.set(cellKey, editingValue);
        setPendingChanges(newChanges);
      }
      setEditingCell(null);
    }
  };

  const saveChanges = () => {
    if (!tableName || !lastQuery) return;

    const changes: any[] = [];
    const originalData: any[] = [];

    pendingChanges.forEach((newValue, cellKey) => {
      const [rowIndexStr, columnName] = cellKey.split('-');
      const rowIndex = parseInt(rowIndexStr);
      const globalRowIndex = startIndex + rowIndex;
      const row = queryResult.rows[globalRowIndex];
      
      if (row) {
        const rowId = row.id;
        changes.push({
          rowId,
          columnName,
          newValue,
          oldValue: row[columnName]
        });
        originalData.push(row);
      }
    });

    const activeTab = tabs.find(tab => tab.id === activeTabId);
    const requestData = {
      connectionId: activeTab?.connectionId || activeConnectionId,
      tableName,
      database: activeTab?.databaseName,
      schema: null,
      fullQuery: statement,
      changes,
      originalData,
      changesCount: changes.length
    };

    updateMutation.mutate(requestData);
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
    <div className="h-full flex flex-col">
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
                  className="text-xs px-2 py-1"
                >
                  <Save className="w-3 h-3 mr-1" />
                  {updateMutation.isPending ? "Saving..." : `Save ${pendingChanges.size} changes`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={discardChanges}
                  className="text-xs px-2 py-1"
                >
                  <X className="w-3 h-3 mr-1" />
                  Discard
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportResults}
              className="text-xs px-2 py-1"
            >
              <Download className="w-3 h-3 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Results Content */}
      {queryResult.rows.length === 0 ? (
        <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-sm">
          No data found
        </div>
      ) : (
        <>
          {/* Table Area */}
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
            <div className="flex-1 overflow-auto">
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
          
          {/* Pagination Bar - Always at Bottom */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  第 {currentPage} 页，共 {totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                显示 {startIndex + 1} 到 {endIndex} 条，共 {queryResult.rows.length} 条结果
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function QueryResults() {
  const { queryResults, queryHistory } = useDatabaseStore();

  if (!queryResults) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 min-h-0 py-4">
        <p>Run a query to see results</p>
      </div>
    );
  }

  // Handle multi-statement results
  if (queryResults.multiStatementResults && queryResults.multiStatementResults.length > 0) {
    const getTabName = (statement: string, index: number) => {
      const cleanStatement = statement.trim();
      const firstLine = cleanStatement.split('\n')[0].trim();
      const operation = firstLine.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TRUNCATE)/i)?.[1]?.toUpperCase();
      
      if (operation === 'SELECT') {
        const tableMatch = firstLine.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          return `查询 ${tableMatch[1]}`;
        }
        return `查询 ${index + 1}`;
      } else if (operation === 'INSERT') {
        const tableMatch = firstLine.match(/INTO\s+(\w+)/i);
        if (tableMatch) {
          return `插入 ${tableMatch[1]}`;
        }
        return `插入 ${index + 1}`;
      } else if (operation === 'UPDATE') {
        const tableMatch = firstLine.match(/UPDATE\s+(\w+)/i);
        if (tableMatch) {
          return `更新 ${tableMatch[1]}`;
        }
        return `更新 ${index + 1}`;
      } else if (operation === 'DELETE') {
        const tableMatch = firstLine.match(/FROM\s+(\w+)/i);
        if (tableMatch) {
          return `删除 ${tableMatch[1]}`;
        }
        return `删除 ${index + 1}`;
      }
      
      return `语句 ${index + 1}`;
    };

    return (
      <div className="flex flex-col flex-1 border-t border-gray-200 dark:border-gray-700 overflow-hidden">
        <Tabs defaultValue="statement-0" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start border-b border-gray-200 dark:border-gray-700 bg-transparent h-auto p-0 flex-shrink-0">
            {queryResults.multiStatementResults.map((result, index) => (
              <TabsTrigger
                key={index}
                value={`statement-${index}`}
                className="px-4 py-2 text-xs border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500 data-[state=active]:text-white bg-transparent rounded-none hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {getTabName(result.statement, index)} ({result.result.rowCount} 行)
              </TabsTrigger>
            ))}
          </TabsList>
          {queryResults.multiStatementResults.map((result, index) => (
            <TabsContent key={index} value={`statement-${index}`} className="flex-1 m-0 p-0 overflow-hidden">
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
  return null;
}