import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Connection, QueryResult, QueryHistory } from '@shared/schema';

interface DatabaseState {
  // Theme
  isDarkMode: boolean;
  toggleTheme: () => void;

  // Connections
  connections: Connection[];
  activeConnectionId: number | null;
  setConnections: (connections: Connection[]) => void;
  setActiveConnection: (id: number | null) => void;

  // Tabs
  tabs: Array<{
    id: string;
    title: string;
    type: 'query' | 'table';
    content: string;
    connectionId?: number;
    tableName?: string;
  }>;
  activeTabId: string | null;
  addTab: (tab: { title: string; type: 'query' | 'table'; connectionId?: number; tableName?: string }) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;

  // Query results
  queryResults: QueryResult | null;
  isExecuting: boolean;
  setQueryResults: (results: QueryResult | null) => void;
  setIsExecuting: (executing: boolean) => void;

  // Query history
  queryHistory: QueryHistory[];
  setQueryHistory: (history: QueryHistory[]) => void;

  // Modal states
  isConnectionModalOpen: boolean;
  setConnectionModalOpen: (open: boolean) => void;
}

export const useDatabaseStore = create<DatabaseState>()(
  persist(
    (set, get) => ({
      // Theme
      isDarkMode: false,
      toggleTheme: () => {
        const newMode = !get().isDarkMode;
        set({ isDarkMode: newMode });
        if (newMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },

      // Connections
      connections: [],
      activeConnectionId: null,
      setConnections: (connections) => set({ connections }),
      setActiveConnection: (id) => set({ activeConnectionId: id }),

      // Tabs
      tabs: [],
      activeTabId: null,
      addTab: (tabData) => {
        const id = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newTab = {
          id,
          content: '',
          ...tabData,
        };
        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        }));
      },
      removeTab: (id) => {
        set((state) => {
          const newTabs = state.tabs.filter(tab => tab.id !== id);
          const newActiveTabId = state.activeTabId === id 
            ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
            : state.activeTabId;
          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
          };
        });
      },
      setActiveTab: (id) => set({ activeTabId: id }),
      updateTabContent: (id, content) => {
        set((state) => ({
          tabs: state.tabs.map(tab =>
            tab.id === id ? { ...tab, content } : tab
          ),
        }));
      },

      // Query results
      queryResults: null,
      isExecuting: false,
      setQueryResults: (results) => set({ queryResults: results }),
      setIsExecuting: (executing) => set({ isExecuting: executing }),

      // Query history
      queryHistory: [],
      setQueryHistory: (history) => set({ queryHistory: history }),

      // Modal states
      isConnectionModalOpen: false,
      setConnectionModalOpen: (open) => set({ isConnectionModalOpen: open }),
    }),
    {
      name: 'database-store',
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        connections: state.connections,
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        activeConnectionId: state.activeConnectionId,
      }),
    }
  )
);

// Initialize theme on load
if (typeof window !== 'undefined') {
  const store = useDatabaseStore.getState();
  if (store.isDarkMode) {
    document.documentElement.classList.add('dark');
  }
}
