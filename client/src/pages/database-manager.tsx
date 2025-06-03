import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { DatabaseSidebar } from "@/components/database-sidebar";
import { SQLEditor } from "@/components/sql-editor";
import { QueryResults } from "@/components/query-results";
import { ConnectionModal } from "@/components/connection-modal";
import { TableStructureView } from "@/components/table-structure-view";
import { useDatabaseStore } from "@/lib/database-store";
import { QueryPagination } from "@/components/query-results";

export default function DatabaseManager() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab } =
    useDatabaseStore();

  useEffect(() => {
    // Add initial tab if none exist
    if (tabs.length === 0) {
      addTab({
        title: "Query Editor",
        type: "query",
      });
    }
  }, [tabs.length, addTab]);

  const handleAddTab = () => {
    addTab({
      title: "New Query",
      type: "query",
    });
  };

  const handleCloseTab = (tabId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    removeTab(tabId);
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      <DatabaseSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab Bar */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-900 dark:to-slate-900 border-b border-gray-200/60 dark:border-gray-700/60 flex-shrink-0 shadow-sm">
          <div className="flex items-center overflow-x-auto scrollbar-hide">
            <Tabs
              value={activeTabId || ""}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <div className="flex items-center space-x-2 px-6 py-3">
                <TabsList className="flex space-x-1 bg-transparent h-auto p-0">
                  {tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="group relative flex items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-in-out
                        bg-white/80 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 shadow-sm
                        hover:bg-white dark:hover:bg-gray-800 hover:shadow-md hover:border-gray-300/60 dark:hover:border-gray-600/60 hover:-translate-y-0.5
                        data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 
                        data-[state=active]:text-white data-[state=active]:border-blue-400 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/25
                        dark:data-[state=active]:from-blue-600 dark:data-[state=active]:to-indigo-600 dark:data-[state=active]:border-blue-500"
                    >
                      <span className="mr-2 font-medium tracking-wide">{tab.title}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleCloseTab(tab.id, e)}
                        className="ml-1 p-1 h-auto w-auto opacity-60 hover:opacity-100 rounded-md transition-all duration-150
                          hover:bg-black/10 dark:hover:bg-white/10 group-data-[state=active]:hover:bg-white/20"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddTab}
                  className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                    bg-white/60 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-xl
                    hover:bg-white dark:hover:bg-gray-800 hover:shadow-md hover:border-gray-300/60 dark:hover:border-gray-600/60 
                    hover:-translate-y-0.5 transition-all duration-200 ease-in-out"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <Tabs
            value={activeTabId || ""}
            onValueChange={setActiveTab}
            className="flex flex-col h-full"
          >
            {/* Tab Content */}
            <div className="flex flex-col flex-1 overflow-hidden">
              {tabs.map((tab) => (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="flex flex-col  overflow-hidden m-0 p-0"
                >
                  {tab.type === "query" ? (
                    <div className="flex flex-col h-full">
                      <SQLEditor
                        tabId={tab.id}
                        content={tab.content}
                        connectionId={tab.connectionId}
                        databaseName={tab.databaseName}
                      />
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <QueryResults />
                      </div>
                    </div>
                  ) : tab.type === "table" ? (
                    <TableStructureView
                      tableName={tab.tableName!}
                      connectionId={tab.connectionId!}
                      databaseName={tab.databaseName!}
                    />
                  ) : (
                    <div className="h-32 flex items-center justify-center">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <p>Unknown tab type: {tab.type}</p>
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
