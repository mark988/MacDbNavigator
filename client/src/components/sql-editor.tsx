import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Save, FileText } from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { QueryResult } from '@shared/schema';

// Monaco Editor will be loaded dynamically
let monaco: any = null;

interface SQLEditorProps {
  tabId: string;
  content: string;
  connectionId?: number;
}

export function SQLEditor({ tabId, content, connectionId }: SQLEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { 
    updateTabContent, 
    setQueryResults, 
    setIsExecuting, 
    isExecuting,
    isDarkMode,
    connections,
    activeConnectionId
  } = useDatabaseStore();

  const executeQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      const connId = connectionId || activeConnectionId;
      if (!connId) {
        throw new Error('No active connection selected');
      }

      const response = await fetch(`/api/connections/${connId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Query execution failed');
      }

      return response.json() as Promise<QueryResult>;
    },
    onMutate: () => {
      setIsExecuting(true);
    },
    onSuccess: (data) => {
      setQueryResults(data);
      queryClient.invalidateQueries({ queryKey: ['/api/query-history'] });
      toast({
        title: "Query executed successfully",
        description: `${data.rowCount} rows returned in ${data.executionTime}ms`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Query execution failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsExecuting(false);
    },
  });

  useEffect(() => {
    const loadMonaco = async () => {
      if (!editorRef.current || monaco) return;

      try {
        // Load Monaco Editor from CDN
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js';
        script.onload = () => {
          (window as any).require.config({ 
            paths: { vs: 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } 
          });
          (window as any).require(['vs/editor/editor.main'], () => {
            monaco = (window as any).monaco;
            initializeEditor();
          });
        };
        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load Monaco Editor:', error);
        // Fallback to simple textarea
        setIsEditorReady(true);
      }
    };

    const initializeEditor = () => {
      if (!monaco || !editorRef.current) return;

      // Define SQL language configuration
      monaco.languages.register({ id: 'sql' });
      monaco.languages.setMonarchTokensProvider('sql', {
        tokenizer: {
          root: [
            [/\b(SELECT|FROM|WHERE|JOIN|INNER|LEFT|RIGHT|ON|GROUP BY|ORDER BY|HAVING|LIMIT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|INDEX|TABLE|DATABASE)\b/i, 'keyword'],
            [/\b(INT|VARCHAR|TEXT|DATE|DATETIME|BOOLEAN|DECIMAL|FLOAT|DOUBLE)\b/i, 'type'],
            [/'([^'\\]|\\.)*'/, 'string'],
            [/--.*/, 'comment'],
            [/\/\*[\s\S]*?\*\//, 'comment'],
            [/\b\d+\.?\d*\b/, 'number'],
          ]
        }
      });

      monacoEditorRef.current = monaco.editor.create(editorRef.current, {
        value: content,
        language: 'sql',
        theme: isDarkMode ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        fontSize: 14,
        fontFamily: 'SF Mono, Monaco, monospace',
      });

      monacoEditorRef.current.onDidChangeModelContent(() => {
        const value = monacoEditorRef.current.getValue();
        updateTabContent(tabId, value);
      });

      // Add keyboard shortcuts
      monacoEditorRef.current.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => executeQuery()
      );

      setIsEditorReady(true);
    };

    loadMonaco();

    return () => {
      if (monacoEditorRef.current) {
        monacoEditorRef.current.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (monacoEditorRef.current && isEditorReady) {
      monaco.editor.setTheme(isDarkMode ? 'vs-dark' : 'vs');
    }
  }, [isDarkMode, isEditorReady]);

  const executeQuery = () => {
    let queryToExecute = content;
    
    if (monacoEditorRef.current) {
      const selection = monacoEditorRef.current.getSelection();
      const selectedText = monacoEditorRef.current.getModel().getValueInRange(selection);
      
      if (selectedText.trim()) {
        queryToExecute = selectedText;
      } else {
        queryToExecute = monacoEditorRef.current.getValue();
      }
    }

    if (!queryToExecute.trim()) {
      toast({
        title: "No query to execute",
        description: "Please enter a SQL query",
        variant: "destructive",
      });
      return;
    }

    executeQueryMutation.mutate(queryToExecute);
  };

  const formatQuery = () => {
    if (monacoEditorRef.current) {
      monacoEditorRef.current.getAction('editor.action.formatDocument').run();
    }
  };

  const saveQuery = () => {
    // This would typically save to a file or query collection
    toast({
      title: "Query saved",
      description: "Query has been saved to your collection",
    });
  };

  const activeConnection = connections.find(c => c.id === (connectionId || activeConnectionId));

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button
              onClick={executeQuery}
              disabled={isExecuting || !activeConnection}
              className="flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isExecuting ? (
                <Square className="w-4 h-4 mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {isExecuting ? 'Stop' : 'Run Query'}
            </Button>
            
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
            
            <Button
              variant="ghost"
              onClick={formatQuery}
              disabled={!isEditorReady}
              className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" />
              Format
            </Button>
            
            <Button
              variant="ghost"
              onClick={saveQuery}
              className="flex items-center px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {activeConnection ? (
                <span>Connected to {activeConnection.name}</span>
              ) : (
                <span>No connection selected</span>
              )}
            </div>
            {activeConnection && (
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  activeConnection.isConnected ? 'bg-green-400' : 'bg-gray-400'
                }`}></div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {activeConnection.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SQL Editor */}
      <div className="flex-1 bg-white dark:bg-gray-900 p-4">
        <div className="h-full bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {!monaco || !isEditorReady ? (
            // Simple textarea editor as primary option
            <textarea
              value={content}
              onChange={(e) => updateTabContent(tabId, e.target.value)}
              className="w-full h-full p-4 font-mono text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none outline-none border-none"
              placeholder="Enter your SQL query here..."
              style={{ fontSize: '14px', lineHeight: '1.5' }}
            />
          ) : (
            <div ref={editorRef} className="w-full h-full" />
          )}
        </div>
      </div>
    </div>
  );
}
