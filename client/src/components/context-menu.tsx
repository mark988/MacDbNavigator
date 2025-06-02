import { useState } from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { FileText, Download } from 'lucide-react';

interface DatabaseContextMenuProps {
  children: React.ReactNode;
  databaseName: string;
  connectionId: number;
  onNewQuery: (databaseName: string, connectionId: number) => void;
  onBackup: (databaseName: string, connectionId: number) => void;
}

export function DatabaseContextMenu({ 
  children, 
  databaseName, 
  connectionId, 
  onNewQuery, 
  onBackup 
}: DatabaseContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
        <div className="mb-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
          数据库: {databaseName}
        </div>
        <ContextMenuItem 
          className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onClick={() => onNewQuery(databaseName, connectionId)}
        >
          <FileText className="w-4 h-4" />
          <span>新建查询</span>
        </ContextMenuItem>
        <ContextMenuItem 
          className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          onClick={() => onBackup(databaseName, connectionId)}
        >
          <Download className="w-4 h-4" />
          <span>备份数据库</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}