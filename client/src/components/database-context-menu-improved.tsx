import { useState, useRef, useEffect } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // 处理右键点击
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // 确保菜单不会超出视窗边界
    const menuWidth = 200;
    const menuHeight = 80;
    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;
    
    setPosition({ x: adjustedX, y: adjustedY });
    setIsOpen(true);
  };

  // 处理点击外部关闭菜单
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
      <div 
        ref={triggerRef}
        onContextMenu={handleContextMenu}
        style={{ width: '100%' }}
      >
        {children}
      </div>
      
      {isOpen && (
        <>
          {/* 透明遮罩层 */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* 上下文菜单 */}
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
              onClick={() => handleMenuItemClick(() => onNewQuery(databaseName, connectionId))}
            >
              <FileText className="w-4 h-4" />
              新建查询
            </button>
            
            <button
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
              onClick={() => handleMenuItemClick(() => onBackup(databaseName, connectionId))}
            >
              <Download className="w-4 h-4" />
              备份数据库
            </button>
          </div>
        </>
      )}
    </>
  );
}