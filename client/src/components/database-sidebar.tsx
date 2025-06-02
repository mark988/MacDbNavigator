import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Database, 
  Table, 
  Plus, 
  ChevronRight, 
  Moon, 
  Sun,
  Circle,
  Loader2,
  Columns,
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';
import { DatabaseContextMenu } from './context-menu';
import { useToast } from '@/hooks/use-toast';
import type { Connection, DatabaseInfo, QueryHistory, TableStructure } from '@shared/schema';

export function DatabaseSidebar() {
  const { 
    isDarkMode, 
    toggleTheme, 
    connections, 
    setConnections, 
    activeConnectionId, 
    setActiveConnection,
    setConnectionModalOpen,
    addTab,
    removeTab,
    tabs,
    queryHistory,
    setQueryHistory
  } = useDatabaseStore();

  const { toast } = useToast();
  const [expandedConnections, setExpandedConnections] = useState<Set<number>>(new Set());
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editingConnectionId, setEditingConnectionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const { data: connectionsData, refetch: refetchConnections } = useQuery({
    queryKey: ['/api/connections'],
    queryFn: async () => {
      const res = await fetch('/api/connections');
      return res.json() as Promise<Connection[]>;
    },
  });

  const { data: historyData } = useQuery({
    queryKey: ['/api/query-history'],
    queryFn: async () => {
      const res = await fetch('/api/query-history');
      return res.json() as Promise<QueryHistory[]>;
    },
  });

  useEffect(() => {
    if (connectionsData) {
      setConnections(connectionsData);
    }
  }, [connectionsData, setConnections]);

  useEffect(() => {
    if (historyData) {
      setQueryHistory(historyData);
    }
  }, [historyData, setQueryHistory]);

  const handleConnectionClick = (connection: Connection) => {
    setActiveConnection(connection.id);
  };

  const handleConnectionToggle = (connectionId: number) => {
    setExpandedConnections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(connectionId)) {
        newSet.delete(connectionId);
      } else {
        newSet.add(connectionId);
      }
      return newSet;
    });
  };

  const handleDatabaseClick = (dbName: string, connectionId: number) => {
    const key = `${connectionId}-${dbName}`;
    if (expandedDatabases.has(key)) {
      setExpandedDatabases(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(key);
        return newSet;
      });
    } else {
      setExpandedDatabases(prev => new Set([...Array.from(prev), key]));
    }
  };

  const handleNewQuery = (dbName: string, connectionId: number) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      // 查找并关闭原始的"Query Editor"标签
      const queryEditorTab = tabs.find(tab => tab.title === "Query Editor");
      if (queryEditorTab) {
        removeTab(queryEditorTab.id);
      }
      
      addTab({
        title: `Query - ${dbName}`,
        type: 'query',
        connectionId,
        databaseName: dbName,
      });
      toast({
        title: "新查询已创建",
        description: `已为数据库 ${dbName} 创建新的查询窗口`,
      });
    }
  };

  const handleBackupDatabase = (dbName: string, connectionId: number) => {
    toast({
      title: "备份功能",
      description: `数据库 ${dbName} 的备份功能正在开发中`,
    });
  };

  const handleDeleteConnection = async (connectionId: number) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('删除连接失败');
      }
      
      // 如果删除的是当前活动连接，清除活动状态
      if (activeConnectionId === connectionId) {
        setActiveConnection(null);
      }
      
      // 刷新连接列表
      refetchConnections();
      
      toast({
        title: "连接已删除",
        description: `连接 "${connection.name}" 已成功删除`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "删除失败",
        description: "删除连接时发生错误",
        variant: "destructive",
      });
    }
  };

  const handleEditConnection = (connectionId: number, currentName: string) => {
    console.log('编辑连接:', connectionId, '当前名称:', currentName);
    setEditingName(currentName);
    setEditingConnectionId(connectionId);
  };

  const handleSaveEdit = async (connectionId: number) => {
    if (!editingName.trim()) {
      toast({
        title: "保存失败",
        description: "连接名称不能为空",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/connections/${connectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (!response.ok) {
        throw new Error('更新连接失败');
      }

      setEditingConnectionId(null);
      setEditingName('');
      refetchConnections();
      
      toast({
        title: "连接已更新",
        description: `连接名称已更新为 "${editingName.trim()}"`,
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: "保存失败",
        description: "更新连接名称时发生错误",
        variant: "destructive",
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingConnectionId(null);
    setEditingName('');
  };

  const handleDatabaseRightClick = (dbName: string, connectionId: number) => {
    handleNewQuery(dbName, connectionId);
  };

  const handleTableClick = (tableName: string, connectionId: number) => {
    const key = `${connectionId}-${tableName}`;
    if (expandedTables.has(key)) {
      setExpandedTables(prev => {
        const newSet = new Set(Array.from(prev));
        newSet.delete(key);
        return newSet;
      });
    } else {
      setExpandedTables(prev => new Set([...Array.from(prev), key]));
    }
  };

  const handleTableDoubleClick = (tableName: string, connectionId: number) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      addTab({
        title: `Table: ${tableName}`,
        type: 'table',
        connectionId,
        tableName,
      });
    }
  };

  const handleHistoryClick = (query: string) => {
    addTab({
      title: 'Query from History',
      type: 'query',
      connectionId: activeConnectionId || undefined,
    });
    // Note: We would update the tab content with the query here
  };

  const getConnectionStatus = (connection: Connection) => {
    if (connection.isConnected) {
      return <Circle className="w-2 h-2 fill-green-400 text-green-400" />;
    }
    return <Circle className="w-2 h-2 fill-gray-400 text-gray-400" />;
  };

  return (
    <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-sm">MacDB Manager</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="p-1.5"
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Connections Section */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Connections
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConnectionModalOpen(true)}
              className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-700 transition-colors"
              title="添加新连接"
            >
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </Button>
          </div>

          <div className="space-y-1">
            {connections.map((connection) => (
              <ConnectionItem
                key={connection.id}
                connection={connection}
                isActive={activeConnectionId === connection.id}
                isExpanded={expandedConnections.has(connection.id)}
                expandedDatabases={expandedDatabases}
                expandedTables={expandedTables}
                onToggle={() => handleConnectionToggle(connection.id)}
                onDatabaseClick={handleDatabaseClick}
                onDatabaseRightClick={handleDatabaseRightClick}
                onTableClick={handleTableClick}
                onTableDoubleClick={handleTableDoubleClick}
                onDeleteConnection={handleDeleteConnection}
                getConnectionStatus={getConnectionStatus}
                editingConnectionId={editingConnectionId}
                editingName={editingName}
                handleEditConnection={handleEditConnection}
                handleSaveEdit={handleSaveEdit}
                handleCancelEdit={handleCancelEdit}
                setEditingName={setEditingName}
              />
            ))}
          </div>
        </div>

        {/* Query History Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Recent Queries
          </h3>
          <div className="space-y-2">
            {queryHistory.slice(0, 5).map((history) => (
              <div
                key={history.id}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => handleHistoryClick(history.query)}
              >
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {history.createdAt ? new Date(history.createdAt).toLocaleString() : 'Unknown time'}
                </div>
                <div className="text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
                  {history.query}
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

interface ConnectionItemProps {
  connection: Connection;
  isActive: boolean;
  isExpanded: boolean;
  expandedDatabases: Set<string>;
  expandedTables: Set<string>;
  onToggle: () => void;
  onDatabaseClick: (dbName: string, connectionId: number) => void;
  onDatabaseRightClick: (dbName: string, connectionId: number) => void;
  onTableClick: (tableName: string, connectionId: number) => void;
  onTableDoubleClick: (tableName: string, connectionId: number) => void;
  onDeleteConnection: (connectionId: number) => void;
  getConnectionStatus: (connection: Connection) => React.ReactNode;
  editingConnectionId: number | null;
  editingName: string;
  handleEditConnection: (connectionId: number, currentName: string) => void;
  handleSaveEdit: (connectionId: number) => void;
  handleCancelEdit: () => void;
  setEditingName: (name: string) => void;
}

function ConnectionItem({ 
  connection, 
  isActive, 
  isExpanded, 
  expandedDatabases,
  expandedTables,
  onToggle, 
  onDatabaseClick,
  onDatabaseRightClick,
  onTableClick, 
  onTableDoubleClick,
  onDeleteConnection,
  getConnectionStatus,
  editingConnectionId,
  editingName,
  handleEditConnection,
  handleSaveEdit,
  handleCancelEdit,
  setEditingName
}: ConnectionItemProps) {
  const { data: databaseInfo, isLoading } = useQuery({
    queryKey: ['/api/connections', connection.id, 'databases'],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connection.id}/databases`);
      if (!res.ok) throw new Error('Failed to fetch database info');
      return res.json() as Promise<DatabaseInfo>;
    },
    enabled: isExpanded,
  });

  return (
    <div className="group">
      <Collapsible open={isExpanded}>
        <div className={`flex items-center p-2 rounded-lg transition-colors ${
          isActive 
            ? 'bg-blue-500 text-white' 
            : 'hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white'
        }`}>
          <div 
            className="flex items-center space-x-2 flex-1 min-w-0 cursor-pointer"
            onClick={() => {
              onToggle();
            }}
          >
            {getConnectionStatus(connection)}
            {editingConnectionId === connection.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="text-sm font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-400 dark:border-gray-500 rounded px-2 py-1 flex-1 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                autoFocus
                onFocus={(e) => {
                  console.log('输入框获得焦点，当前值:', e.target.value);
                  e.target.select(); // 选中所有文本
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveEdit(connection.id);
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-medium truncate">
                {connection.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {editingConnectionId === connection.id ? (
              <>
                <button 
                  className="p-1 hover:bg-green-500 hover:text-white rounded transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveEdit(connection.id);
                  }}
                  title="保存"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button 
                  className="p-1 hover:bg-gray-500 hover:text-white rounded transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelEdit();
                  }}
                  title="取消"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <button 
                  className="p-1 hover:bg-blue-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditConnection(connection.id, connection.name);
                  }}
                  title="编辑连接名称"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button 
                      className="p-1 hover:bg-red-500 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      title="删除连接"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>删除连接</AlertDialogTitle>
                      <AlertDialogDescription>
                        确定要删除连接 "{connection.name}" 吗？此操作无法撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => onDeleteConnection(connection.id)}
                      >
                        删除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            
            <CollapsibleTrigger asChild>
              <button 
                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
              >
                <ChevronRight className={`w-4 h-4 transition-transform ${
                  isExpanded ? 'rotate-90' : ''
                }`} />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>
        
        <CollapsibleContent className="ml-4 mt-1 space-y-1">
          {isLoading ? (
            <div className="flex items-center p-1.5 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              {/* Current Database - only show if database name exists */}
              {connection.database && (
                <DatabaseItem
                  dbName={connection.database}
                  connectionId={connection.id}
                  tables={databaseInfo?.tables || []}
                  isExpanded={expandedDatabases.has(`${connection.id}-${connection.database}`)}
                  expandedTables={expandedTables}
                  onDatabaseClick={onDatabaseClick}
                  onDatabaseRightClick={onDatabaseRightClick}
                  onTableClick={onTableClick}
                  onTableDoubleClick={onTableDoubleClick}
                  isCurrent={true}
                />
              )}
              
              {/* Other Databases */}
              {databaseInfo?.databases.filter(db => db !== connection.database).map((dbName) => (
                <OtherDatabaseItem
                  key={dbName}
                  dbName={dbName}
                  connectionId={connection.id}
                  isExpanded={expandedDatabases.has(`${connection.id}-${dbName}`)}
                  expandedTables={expandedTables}
                  onDatabaseClick={onDatabaseClick}
                  onDatabaseRightClick={onDatabaseRightClick}
                  onTableClick={onTableClick}
                  onTableDoubleClick={onTableDoubleClick}
                />
              ))}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface DatabaseItemProps {
  dbName: string;
  connectionId: number;
  tables: any[];
  isExpanded: boolean;
  expandedTables: Set<string>;
  onDatabaseClick: (dbName: string, connectionId: number) => void;
  onDatabaseRightClick: (dbName: string, connectionId: number) => void;
  onTableClick: (tableName: string, connectionId: number) => void;
  onTableDoubleClick: (tableName: string, connectionId: number) => void;
  isCurrent: boolean;
}

function DatabaseItem({
  dbName,
  connectionId,
  tables,
  isExpanded,
  expandedTables,
  onDatabaseClick,
  onDatabaseRightClick,
  onTableClick,
  onTableDoubleClick,
  isCurrent
}: DatabaseItemProps) {
  return (
    <div>
      <Collapsible open={isExpanded} onOpenChange={() => onDatabaseClick(dbName, connectionId)}>
        <CollapsibleTrigger asChild>
          <DatabaseContextMenu
            databaseName={dbName}
            connectionId={connectionId}
            onNewQuery={onDatabaseRightClick}
            onBackup={(dbName, connectionId) => {
              console.log(`Backup ${dbName} from connection ${connectionId}`);
            }}
          >
            <div 
              className="flex items-center p-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white rounded cursor-pointer"
            >
              <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`} />
              <Database className="w-4 h-4 mr-2" />
              <span className={isCurrent ? 'font-medium' : ''}>{dbName}</span>
              {isCurrent && (
                <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">(current)</span>
              )}
            </div>
          </DatabaseContextMenu>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="ml-6 space-y-1">
          {tables.map((table) => (
            <TableItem
              key={table.name}
              tableName={table.name}
              connectionId={connectionId}
              isExpanded={expandedTables.has(`${connectionId}-${table.name}`)}
              onTableClick={onTableClick}
              onTableDoubleClick={onTableDoubleClick}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface TableItemProps {
  tableName: string;
  connectionId: number;
  isExpanded: boolean;
  onTableClick: (tableName: string, connectionId: number) => void;
  onTableDoubleClick: (tableName: string, connectionId: number) => void;
}

function TableItem({
  tableName,
  connectionId,
  isExpanded,
  onTableClick,
  onTableDoubleClick
}: TableItemProps) {
  const { data: tableStructure, isLoading } = useQuery({
    queryKey: ['/api/connections', connectionId, 'tables', tableName, 'columns'],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connectionId}/tables/${tableName}/columns`);
      if (!res.ok) throw new Error('Failed to fetch table structure');
      return res.json() as Promise<TableStructure>;
    },
    enabled: isExpanded,
  });

  return (
    <div>
      <Collapsible open={isExpanded} onOpenChange={() => onTableClick(tableName, connectionId)}>
        <CollapsibleTrigger asChild>
          <div 
            className="flex items-center p-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white rounded cursor-pointer"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onTableDoubleClick(tableName, connectionId);
            }}
          >
            <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`} />
            <Table className="w-3 h-3 mr-2" />
            <span>{tableName}</span>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="ml-6 space-y-0.5">
          {isLoading ? (
            <div className="flex items-center p-1 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Loading columns...
            </div>
          ) : (
            tableStructure?.columns.map((column) => (
              <div
                key={column.name}
                className="flex items-center p-1 text-xs text-gray-500 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
                title={`${column.type}${column.nullable ? ' (nullable)' : ' (not null)'}`}
              >
                <Columns className="w-3 h-3 mr-2" />
                <span className="font-mono">{column.name}</span>
                <span className="ml-2 text-gray-400">({column.type})</span>
              </div>
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface OtherDatabaseItemProps {
  dbName: string;
  connectionId: number;
  isExpanded: boolean;
  expandedTables: Set<string>;
  onDatabaseClick: (dbName: string, connectionId: number) => void;
  onDatabaseRightClick: (dbName: string, connectionId: number) => void;
  onTableClick: (tableName: string, connectionId: number) => void;
  onTableDoubleClick: (tableName: string, connectionId: number) => void;
}

function OtherDatabaseItem({
  dbName,
  connectionId,
  isExpanded,
  expandedTables,
  onDatabaseClick,
  onDatabaseRightClick,
  onTableClick,
  onTableDoubleClick
}: OtherDatabaseItemProps) {
  const { data: tablesData, isLoading } = useQuery({
    queryKey: ['/api/connections', connectionId, 'databases', dbName, 'tables'],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connectionId}/databases/${dbName}/tables`);
      if (!res.ok) throw new Error('Failed to fetch tables');
      return res.json() as Promise<{ tables: any[] }>;
    },
    enabled: isExpanded,
  });

  return (
    <div>
      <Collapsible open={isExpanded}>
        <DatabaseContextMenu
          databaseName={dbName}
          connectionId={connectionId}
          onNewQuery={onDatabaseRightClick}
          onBackup={(dbName, connectionId) => {
            console.log(`Backup ${dbName} from connection ${connectionId}`);
          }}
        >
          <div 
            className="flex items-center p-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white rounded cursor-pointer"
            onClick={() => onDatabaseClick(dbName, connectionId)}
          >
            <ChevronRight className={`w-3 h-3 mr-1 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`} />
            <Database className="w-4 h-4 mr-2" />
            <span>{dbName}</span>
          </div>
        </DatabaseContextMenu>
        
        <CollapsibleContent className="ml-6 space-y-1">
          {isLoading ? (
            <div className="flex items-center p-1 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Loading tables...
            </div>
          ) : tablesData?.tables && tablesData.tables.length > 0 ? (
            tablesData.tables.map((table) => (
              <TableItem
                key={table.name}
                tableName={table.name}
                connectionId={connectionId}
                isExpanded={expandedTables.has(`${connectionId}-${table.name}`)}
                onTableClick={onTableClick}
                onTableDoubleClick={onTableDoubleClick}
              />
            ))
          ) : (
            <div className="flex items-center p-1 text-xs text-gray-500">
              No tables found
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
