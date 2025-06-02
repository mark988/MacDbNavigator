import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Database, 
  Table, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Edit2,
  Check,
  X,
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';
import { useToast } from '@/hooks/use-toast';
import { Connection, DatabaseInfo, TableStructure } from '@shared/schema';
import { ConnectionModal } from './connection-modal';
import { EditConnectionModal } from './edit-connection-modal';
import { DatabaseContextMenu } from './context-menu';
import { TableContextMenu } from './table-context-menu';
import { BackupDialog } from './backup-dialog';

export function DatabaseSidebar() {
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [editConnectionModalOpen, setEditConnectionModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [expandedConnections, setExpandedConnections] = useState<Set<number>>(new Set());
  const [expandedDatabases, setExpandedDatabases] = useState<Set<string>>(new Set());
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [editingConnectionId, setEditingConnectionId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [backupDialog, setBackupDialog] = useState<{
    open: boolean;
    tableName: string;
    connectionId: number;
    databaseName: string;
  }>({
    open: false,
    tableName: '',
    connectionId: 0,
    databaseName: ''
  });

  const { activeTabId, tabs, addTab, setCurrentDatabaseConnection } = useDatabaseStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['/api/connections'],
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/connections/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete connection');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      toast({
        title: "Success",
        description: "Connection deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateConnectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number, name: string }) => {
      const connection = connections.find(c => c.id === id);
      if (!connection) throw new Error('Connection not found');
      
      const res = await fetch(`/api/connections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...connection, name }),
      });
      if (!res.ok) throw new Error('Failed to update connection');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setEditingConnectionId(null);
      setEditingName('');
      toast({
        title: "Success",
        description: "Connection updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConnectionClick = (connection: Connection) => {
    const isExpanded = expandedConnections.has(connection.id);
    setExpandedConnections(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.delete(connection.id);
      } else {
        newSet.add(connection.id);
      }
      return newSet;
    });
  };

  const handleDatabaseClick = (dbName: string, connectionId: number) => {
    const key = `${connectionId}-${dbName}`;
    const isExpanded = expandedDatabases.has(key);
    setExpandedDatabases(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
    
    setCurrentDatabaseConnection(connectionId, dbName);
  };

  const handleDatabaseRightClick = (dbName: string, connectionId: number) => {
    // Handle right-click context menu
  };

  const handleTableClick = (tableName: string, connectionId: number) => {
    const key = `${connectionId}-${tableName}`;
    const isExpanded = expandedTables.has(key);
    setExpandedTables(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleTableDoubleClick = (tableName: string, connectionId: number) => {
    const { currentDatabaseName } = useDatabaseStore.getState();
    if (currentDatabaseName) {
      const tabId = `table-${connectionId}-${currentDatabaseName}-${tableName}`;
      const query = `SELECT * FROM ${tableName} LIMIT 100;`;
      addTab({
        id: tabId,
        title: `Query ${tableName}`,
        type: 'query' as const,
        content: query,
        connectionId,
        databaseName: currentDatabaseName,
        isModified: false
      });
    }
  };

  const handleNewQuery = (databaseName: string, connectionId: number) => {
    const tabId = `query-${Date.now()}`;
    addTab({
      id: tabId,
      title: `New Query`,
      type: 'query' as const,
      content: '',
      connectionId,
      databaseName,
      isModified: false
    });
  };

  const handleBackup = (databaseName: string, connectionId: number) => {
    // Handle database backup
  };

  const handleTableBackup = (tableName: string, connectionId: number, databaseName: string) => {
    setBackupDialog({
      open: true,
      tableName,
      connectionId,
      databaseName
    });
  };

  const handleDeleteConnection = (connectionId: number) => {
    deleteConnectionMutation.mutate(connectionId);
  };

  const handleEditConnection = (connectionId: number, currentName: string) => {
    setEditingConnectionId(connectionId);
    setEditingName(currentName);
  };

  const handleSaveEdit = (connectionId: number) => {
    if (editingName.trim()) {
      updateConnectionMutation.mutate({ id: connectionId, name: editingName.trim() });
    }
  };

  const handleCancelEdit = () => {
    setEditingConnectionId(null);
    setEditingName('');
  };

  const getConnectionStatus = (connection: Connection) => {
    if (connection.isConnected) {
      return <Wifi className="h-3 w-3 text-green-500" />;
    } else {
      return <WifiOff className="h-3 w-3 text-red-500" />;
    }
  };

  if (connectionsLoading) {
    return (
      <div className="w-64 border-r bg-white dark:bg-gray-900 p-2">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 border-r bg-white dark:bg-gray-900 px-2 pt-1 pb-0 mb-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium">Databases</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConnectionModalOpen(true)}
            className="h-6 w-6 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-1">
          {connections.map((connection) => (
            <ConnectionItem
              key={connection.id}
              connection={connection}
              isActive={expandedConnections.has(connection.id)}
              isExpanded={expandedConnections.has(connection.id)}
              expandedDatabases={expandedDatabases}
              expandedTables={expandedTables}
              onToggle={() => handleConnectionClick(connection)}
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
              onNewQuery={handleNewQuery}
              onBackup={handleBackup}
              onTableBackup={handleTableBackup}
            />
          ))}
        </div>
      </div>

      <ConnectionModal
        open={isConnectionModalOpen}
        onOpenChange={setIsConnectionModalOpen}
      />

      <EditConnectionModal
        connection={editingConnection}
        open={editConnectionModalOpen}
        onOpenChange={setEditConnectionModalOpen}
      />

      <BackupDialog
        open={backupDialog.open}
        onOpenChange={(open) => setBackupDialog(prev => ({ ...prev, open }))}
        tableName={backupDialog.tableName}
        connectionId={backupDialog.connectionId}
        databaseName={backupDialog.databaseName}
      />
    </>
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
  onNewQuery: (databaseName: string, connectionId: number) => void;
  onBackup: (databaseName: string, connectionId: number) => void;
  onTableBackup: (tableName: string, connectionId: number, databaseName: string) => void;
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
  setEditingName,
  onNewQuery,
  onBackup,
  onTableBackup
}: ConnectionItemProps) {
  const { data: databaseInfo } = useQuery({
    queryKey: ['/api/connections', connection.id, 'databases'],
    enabled: isExpanded,
  });

  return (
    <Collapsible open={isExpanded}>
      <div className="flex items-center space-x-1">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            onClick={onToggle}
            className="flex-1 justify-start h-7 px-1 text-xs"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Database className="h-3 w-3 ml-1" />
            {editingConnectionId === connection.id ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="ml-1 h-5 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(connection.id);
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            ) : (
              <span className="ml-1 truncate flex-1 text-left">{connection.name}</span>
            )}
            {getConnectionStatus(connection)}
          </Button>
        </CollapsibleTrigger>
        
        <div className="flex space-x-1">
          {editingConnectionId === connection.id ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSaveEdit(connection.id)}
                className="h-6 w-6 p-0"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditConnection(connection.id, connection.name)}
                className="h-6 w-6 p-0"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteConnection(connection.id)}
                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>

      <CollapsibleContent className="ml-3">
        {isExpanded && (
          <>
            {/* Current Database */}
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
                onNewQuery={onNewQuery}
                onBackup={onBackup}
                onTableBackup={onTableBackup}
              />
            )}
            
            {/* Other Databases */}
            {databaseInfo?.databases?.filter(db => db !== connection.database).map((dbName) => (
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
                onTableBackup={onTableBackup}
              />
            ))}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
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
  onNewQuery: (databaseName: string, connectionId: number) => void;
  onBackup: (databaseName: string, connectionId: number) => void;
  onTableBackup: (tableName: string, connectionId: number, databaseName: string) => void;
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
  isCurrent,
  onNewQuery,
  onBackup,
  onTableBackup
}: DatabaseItemProps) {
  return (
    <Collapsible open={isExpanded}>
      <DatabaseContextMenu
        databaseName={dbName}
        connectionId={connectionId}
        onNewQuery={onNewQuery}
        onBackup={onBackup}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            onClick={() => onDatabaseClick(dbName, connectionId)}
            onContextMenu={() => onDatabaseRightClick(dbName, connectionId)}
            className={`w-full justify-start h-6 px-2 text-xs ${
              isCurrent ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Database className="h-3 w-3 ml-1" />
            <span className="ml-1 truncate">{dbName}</span>
            {isCurrent && <span className="ml-auto text-blue-600 text-xs">(current)</span>}
          </Button>
        </CollapsibleTrigger>
      </DatabaseContextMenu>

      <CollapsibleContent className="ml-3">
        {tables.map((table) => (
          <TableItem
            key={table.name}
            tableName={table.name}
            connectionId={connectionId}
            databaseName={dbName}
            isExpanded={expandedTables.has(`${connectionId}-${table.name}`)}
            onTableClick={onTableClick}
            onTableDoubleClick={onTableDoubleClick}
            onTableBackup={onTableBackup}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface TableItemProps {
  tableName: string;
  connectionId: number;
  databaseName: string;
  isExpanded: boolean;
  onTableClick: (tableName: string, connectionId: number) => void;
  onTableDoubleClick: (tableName: string, connectionId: number) => void;
  onTableBackup: (tableName: string, connectionId: number, databaseName: string) => void;
}

function TableItem({
  tableName,
  connectionId,
  databaseName,
  isExpanded,
  onTableClick,
  onTableDoubleClick,
  onTableBackup
}: TableItemProps) {
  const { activeTabId, tabs, addTab } = useDatabaseStore();
  const { toast } = useToast();
  
  const { data: tableStructure, isLoading } = useQuery({
    queryKey: ['/api/connections', connectionId, 'tables', tableName, 'columns'],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connectionId}/tables/${tableName}/columns?database=${databaseName}`);
      if (!res.ok) throw new Error('Failed to fetch table structure');
      return res.json() as Promise<TableStructure>;
    },
    enabled: isExpanded,
  });

  const handleQueryTable = (tableName: string, connectionId: number, databaseName: string) => {
    const tabId = `table-query-${connectionId}-${databaseName}-${tableName}`;
    const query = `SELECT * FROM ${tableName} LIMIT 100;`;
    addTab({
      id: tabId,
      title: `Query ${tableName}`,
      type: 'query' as const,
      content: query,
      connectionId,
      databaseName,
      isModified: false
    });
  };

  const handleViewStructure = (tableName: string, connectionId: number, databaseName: string) => {
    const tabId = `structure-${connectionId}-${databaseName}-${tableName}`;
    addTab({
      id: tabId,
      title: `Structure: ${tableName}`,
      type: 'structure' as const,
      content: '',
      connectionId,
      databaseName,
      tableName,
      isModified: false
    });
  };

  return (
    <div className="ml-1">
      <TableContextMenu
        tableName={tableName}
        connectionId={connectionId}
        databaseName={databaseName}
        onQueryTable={handleQueryTable}
        onViewStructure={handleViewStructure}
        onBackupTable={onTableBackup}
      >
        <Button
          variant="ghost"
          onClick={() => onTableClick(tableName, connectionId)}
          onDoubleClick={() => onTableDoubleClick(tableName, connectionId)}
          className="w-full justify-start h-5 px-2 text-xs"
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Table className="h-3 w-3 ml-1" />
          <span className="ml-1 truncate">{tableName}</span>
        </Button>
      </TableContextMenu>

      {isExpanded && (
        <div className="ml-4 text-xs">
          {isLoading ? (
            <div className="flex items-center p-1 text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
              Loading columns...
            </div>
          ) : tableStructure?.columns && tableStructure.columns.length > 0 ? (
            tableStructure.columns.slice(0, 5).map((column) => (
              <div key={column.name} className="flex items-center p-1 text-gray-600 dark:text-gray-400">
                <span className="truncate">{column.name}</span>
                <span className="ml-auto text-gray-400 text-xs">{column.type}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center p-1 text-xs text-gray-500">
              No columns found
            </div>
          )}
          {tableStructure?.columns && tableStructure.columns.length > 5 && (
            <div className="p-1 text-xs text-gray-500">
              ... and {tableStructure.columns.length - 5} more
            </div>
          )}
        </div>
      )}
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
  onTableBackup: (tableName: string, connectionId: number, databaseName: string) => void;
}

function OtherDatabaseItem({
  dbName,
  connectionId,
  isExpanded,
  expandedTables,
  onDatabaseClick,
  onDatabaseRightClick,
  onTableClick,
  onTableDoubleClick,
  onTableBackup
}: OtherDatabaseItemProps) {
  const { data: tablesData, isLoading } = useQuery({
    queryKey: ['/api/connections', connectionId, 'databases', dbName, 'tables'],
    queryFn: async () => {
      const res = await fetch(`/api/connections/${connectionId}/databases/${dbName}/tables`);
      if (!res.ok) throw new Error('Failed to fetch tables');
      return res.json() as Promise<DatabaseInfo>;
    },
    enabled: isExpanded,
  });

  return (
    <Collapsible open={isExpanded}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          onClick={() => onDatabaseClick(dbName, connectionId)}
          onContextMenu={() => onDatabaseRightClick(dbName, connectionId)}
          className="w-full justify-start h-6 px-2 text-xs"
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <Database className="h-3 w-3 ml-1" />
          <span className="ml-1 truncate">{dbName}</span>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="ml-3">
        {isLoading ? (
          <div className="flex items-center p-1 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
            Loading tables...
          </div>
        ) : tablesData?.tables && tablesData.tables.length > 0 ? (
          tablesData.tables.map((table) => (
            <TableItem
              key={table.name}
              tableName={table.name}
              connectionId={connectionId}
              databaseName={dbName}
              isExpanded={expandedTables.has(`${connectionId}-${table.name}`)}
              onTableClick={onTableClick}
              onTableDoubleClick={onTableDoubleClick}
              onTableBackup={onTableBackup}
            />
          ))
        ) : (
          <div className="flex items-center p-1 text-xs text-gray-500">
            No tables found
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}