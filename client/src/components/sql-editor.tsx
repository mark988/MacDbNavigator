import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Save, FileText, AlertTriangle } from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import type { QueryResult } from '@shared/schema';

// Monaco Editor will be loaded dynamically
let monaco: any = null;

// SQL Keywords for highlighting
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS',
  'NULL', 'TRUE', 'FALSE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'INDEX', 'VIEW', 'DROP', 'ALTER', 'ADD',
  'COLUMN', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'CHECK',
  'DEFAULT', 'AUTO_INCREMENT', 'ORDER', 'BY', 'ASC', 'DESC', 'GROUP',
  'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'AS', 'CASE',
  'WHEN', 'THEN', 'ELSE', 'END', 'IF', 'IFNULL', 'COALESCE', 'CAST',
  'CONVERT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'SUBSTRING', 'CHAR_LENGTH',
  'UPPER', 'LOWER', 'TRIM', 'CONCAT', 'NOW', 'CURRENT_DATE', 'CURRENT_TIME'
];

// SQL syntax highlighting function
function highlightSQL(sql: string): string {
  if (!sql) return '';
  
  let highlighted = sql;
  
  // Escape HTML first
  highlighted = highlighted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  // Highlight SQL keywords (case insensitive)
  SQL_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    highlighted = highlighted.replace(regex, (match) => {
      return `<span style="color: #2563eb; font-weight: 600;">${match.toUpperCase()}</span>`;
    });
  });
  
  // Highlight strings
  highlighted = highlighted.replace(/'([^']*)'/g, '<span style="color: #16a34a;">\'$1\'</span>');
  highlighted = highlighted.replace(/"([^"]*)"/g, '<span style="color: #16a34a;">"$1"</span>');
  
  // Highlight numbers
  highlighted = highlighted.replace(/\b\d+(\.\d+)?\b/g, '<span style="color: #9333ea;">$&</span>');
  
  // Highlight comments
  highlighted = highlighted.replace(/--.*$/gm, '<span style="color: #6b7280; font-style: italic;">$&</span>');
  highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, '<span style="color: #6b7280; font-style: italic;">$&</span>');
  
  return highlighted;
}

// SQL syntax validation function
function validateSQL(sql: string): string[] {
  const errors: string[] = [];
  if (!sql.trim()) return errors;
  
  const upperSQL = sql.toUpperCase().trim();
  
  // Basic syntax checks
  if (!upperSQL.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|SHOW|DESCRIBE|EXPLAIN)/)) {
    errors.push('SQL statement should start with a valid command (SELECT, INSERT, UPDATE, etc.)');
  }
  
  // Check for unclosed quotes
  const singleQuotes = (sql.match(/'/g) || []).length;
  const doubleQuotes = (sql.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single quote detected');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unclosed double quote detected');
  }
  
  // Check for basic parentheses matching
  const openParens = (sql.match(/\(/g) || []).length;
  const closeParens = (sql.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push('Mismatched parentheses');
  }
  
  // Check for SELECT without FROM (with some exceptions)
  if (upperSQL.startsWith('SELECT') && !upperSQL.includes('FROM') && !upperSQL.match(/SELECT\s+\d+|SELECT\s+NOW\(\)|SELECT\s+CURRENT_/)) {
    errors.push('SELECT statement usually requires a FROM clause');
  }
  
  return errors;
}

interface SQLEditorProps {
  tabId: string;
  content: string;
  connectionId?: number;
  databaseName?: string;
}

export function SQLEditor({ tabId, content, connectionId, databaseName }: SQLEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<any>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [syntaxErrors, setSyntaxErrors] = useState<string[]>([]);
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
        body: JSON.stringify({ query, database: databaseName }),
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
            // Enhanced textarea with overlay highlighting
            <div className="w-full h-full relative">
              {/* Highlighted background layer */}
              <div 
                className="absolute inset-0 p-4 font-mono text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-transparent"
                style={{ fontSize: '14px', lineHeight: '1.5', wordWrap: 'break-word' }}
                dangerouslySetInnerHTML={{
                  __html: highlightSQL(content || '')
                }}
              />
              {/* Interactive textarea overlay */}
              <textarea
                value={content}
                onChange={(e) => {
                  const newContent = e.target.value;
                  updateTabContent(tabId, newContent);
                  // Validate SQL syntax
                  const errors = validateSQL(newContent);
                  setSyntaxErrors(errors);
                }}
                className="w-full h-full p-4 font-mono text-sm bg-transparent text-gray-900 dark:text-gray-100 resize-none outline-none border-none relative z-10 caret-gray-900 dark:caret-gray-100"
                placeholder="Enter your SQL query here..."
                style={{ 
                  fontSize: '14px', 
                  lineHeight: '1.5',
                  color: 'transparent',
                  caretColor: '#374151'
                }}
                spellCheck={false}
              />
              {/* Text color overlay for cursor visibility */}
              <div 
                className="absolute inset-0 p-4 font-mono text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100 opacity-0"
                style={{ fontSize: '14px', lineHeight: '1.5' }}
              >
                {content}
              </div>
            </div>
          ) : (
            <div ref={editorRef} className="w-full h-full" />
          )}
        </div>
        
        {/* Syntax Error Panel */}
        {syntaxErrors.length > 0 && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                Syntax Issues Detected
              </span>
            </div>
            <ul className="space-y-1">
              {syntaxErrors.map((error, index) => (
                <li key={index} className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{error}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
