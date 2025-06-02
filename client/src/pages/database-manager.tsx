import { useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import { DatabaseSidebar } from '@/components/database-sidebar';
import { SQLEditor } from '@/components/sql-editor';
import { QueryResults } from '@/components/query-results';
import { ConnectionModal } from '@/components/connection-modal';
import { useDatabaseStore } from '@/lib/database-store';
import { QueryPagination } from '@/components/query-results';

export default function DatabaseManager() {
  const { 
    tabs, 
    activeTabId, 
    addTab, 
    removeTab, 
    setActiveTab 
  } = useDatabaseStore();

  useEffect(() => {
    // Add initial tab if none exist
    if (tabs.length === 0) {
      addTab({
        title: 'Query Editor',
        type: 'query',
      });
    }
  }, [tabs.length, addTab]);

  const handleAddTab = () => {
    addTab({
      title: 'New Query',
      type: 'query',
    });
  };

  const handleCloseTab = (tabId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    removeTab(tabId);
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <DatabaseSidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center overflow-x-auto">
            <Tabs value={activeTabId || ''} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center space-x-1 p-2">
                <TabsList className="flex space-x-1 bg-transparent h-auto p-0">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="flex items-center px-4 py-2 rounded-lg text-sm font-medium data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 data-[state=active]:border data-[state=active]:border-blue-200 dark:data-[state=active]:bg-blue-900/20 dark:data-[state=active]:text-blue-400 dark:data-[state=active]:border-blue-800"
                    >
                      <span className="mr-2">{tab.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleCloseTab(tab.id, e)}
                        className="ml-1 p-0.5 h-auto hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddTab}
                  className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Tabs value={activeTabId || ''} onValueChange={setActiveTab} className="flex flex-col h-full">
            {/* Tab Content */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {tabs.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="flex flex-col h-full overflow-hidden m-0 p-0"
                >
                  {tab.type === 'query' ? (
                    <div className="flex flex-col h-full">
                      <SQLEditor
                        tabId={tab.id}
                        content={tab.content}
                        connectionId={tab.connectionId}
                        databaseName={tab.databaseName}
                      />
                      <QueryResults />
                      <QueryPagination />
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <p>Table view for {tab.tableName}</p>
                        <p className="text-sm mt-1">Table browsing functionality coming soon</p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>

      <ConnectionModal />
    </div>
  );
}
