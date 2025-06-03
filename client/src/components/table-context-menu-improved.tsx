import { useState, useRef, useEffect } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const x = e.clientX;
    const y = e.clientY;
    
    // 确保菜单不会超出视窗边界
    const menuWidth = 200;
    const menuHeight = 120;
    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;
    
    setPosition({ x: adjustedX, y: adjustedY });
    setIsOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen]);

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ width: '100%' }}>
        {children}
      </div>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          <div
            ref={menuRef}
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2 min-w-[160px]"
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              onClick={() => handleMenuItemClick(() => onQueryTable(tableName, connectionId, databaseName))}
            >
              <Search className="w-4 h-4" />
              查询表数据
            </button>
            
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              onClick={() => handleMenuItemClick(() => onViewStructure(tableName, connectionId, databaseName))}
            >
              <Table2 className="w-4 h-4" />
              查看表结构
            </button>
            
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              onClick={() => handleMenuItemClick(() => onBackupTable(tableName, connectionId, databaseName))}
            >
              <Download className="w-4 h-4" />
              备份表数据
            </button>
          </div>
        </>
      )}
    </>
  );
}