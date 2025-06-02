import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Search, Table2, Download } from 'lucide-react';

interface TableContextMenuProps {
  children: React.ReactNode;
  tableName: string;
  connectionId: number;
  databaseName: string;
  onQueryTable: (tableName: string, connectionId: number, databaseName: string) => void;
  onViewStructure: (tableName: string, connectionId: number, databaseName: string) => void;
  onBackupTable: (tableName: string, connectionId: number, databaseName: string) => void;
}

export function TableContextMenu({ 
  children,
  tableName,
  connectionId,
  databaseName,
  onQueryTable,
  onViewStructure,
  onBackupTable
}: TableContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem 
          onClick={() => onQueryTable(tableName, connectionId, databaseName)}
          className="flex items-center cursor-pointer"
        >
          <Search className="w-4 h-4 mr-2" />
          查询表数据
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={() => onViewStructure(tableName, connectionId, databaseName)}
          className="flex items-center cursor-pointer"
        >
          <Table2 className="w-4 h-4 mr-2" />
          查看表结构
        </ContextMenuItem>
        <ContextMenuItem 
          onClick={() => onBackupTable(tableName, connectionId, databaseName)}
          className="flex items-center cursor-pointer"
        >
          <Download className="w-4 h-4 mr-2" />
          备份表数据
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}