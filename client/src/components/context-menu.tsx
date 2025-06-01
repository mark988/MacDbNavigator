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
      <ContextMenuContent className="w-48">
        <ContextMenuItem 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onNewQuery(databaseName, connectionId)}
        >
          <FileText className="w-4 h-4" />
          新建查询
        </ContextMenuItem>
        <ContextMenuItem 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onBackup(databaseName, connectionId)}
        >
          <Download className="w-4 h-4" />
          备份数据库
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}