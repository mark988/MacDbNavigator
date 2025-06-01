import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Database, 
  Table, 
  Plus, 
  ChevronRight, 
  Moon, 
  Sun,
  Circle,
  Loader2
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';
import type { Connection, DatabaseInfo, QueryHistory } from '@shared/schema';

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
    queryHistory,
    setQueryHistory
  } = useDatabaseStore();

  const [expandedConnections, setExpandedConnections] = useState<Set<number>>(new Set());

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
    if (!expandedConnections.has(connection.id)) {
      setExpandedConnections(prev => new Set([...prev, connection.id]));
    }
  };

  const handleTableClick = (tableName: string, connectionId: number) => {
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
              variant="ghost"
              size="sm"
              onClick={() => setConnectionModalOpen(true)}
              className="p-1"
            >
              <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </Button>
          </div>

          <div className="space-y-1">
            {connections.map((connection) => (
              <ConnectionItem
                key={connection.id}
                connection={connection}
                isActive={activeConnectionId === connection.id}
                isExpanded={expandedConnections.has(connection.id)}
                onToggle={() => handleConnectionClick(connection)}
                onTableClick={(tableName) => handleTableClick(tableName, connection.id)}
                getConnectionStatus={getConnectionStatus}
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
  onToggle: () => void;
  onTableClick: (tableName: string) => void;
  getConnectionStatus: (connection: Connection) => React.ReactNode;
}

function ConnectionItem({ 
  connection, 
  isActive, 
  isExpanded, 
  onToggle, 
  onTableClick, 
  getConnectionStatus 
}: ConnectionItemProps) {
  const { data: databaseInfo, isLoading } = useQuery({
    queryKey: ['/api/connections', connection.id, 'databases'],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connection.id}/databases`);
      if (!res.ok) throw new Error('Failed to fetch database info');
      return res.json() as Promise<DatabaseInfo>;
    },
    enabled: isExpanded && connection.isConnected,
  });

  return (
    <div className="group">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <div className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
            isActive 
              ? 'bg-blue-500 text-white' 
              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}>
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {getConnectionStatus(connection)}
              <span className="text-sm font-medium truncate">
                {connection.name}
              </span>
            </div>
            <ChevronRight className={`w-4 h-4 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`} />
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="ml-4 mt-1 space-y-1">
          {isLoading ? (
            <div className="flex items-center p-1.5 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              <div className="flex items-center p-1.5 text-sm text-gray-700 dark:text-gray-300">
                <Database className="w-4 h-4 mr-2" />
                <span>{connection.database}</span>
              </div>
              {databaseInfo?.tables.map((table) => (
                <div
                  key={table.name}
                  className="flex items-center p-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer ml-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTableClick(table.name);
                  }}
                >
                  <Table className="w-3 h-3 mr-2" />
                  <span>{table.name}</span>
                </div>
              ))}
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
