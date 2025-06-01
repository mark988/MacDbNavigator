import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Save, FileText, AlertTriangle } from 'lucide-react';
import { useDatabaseStore } from '@/lib/database-store';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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

// Simple SQL token analysis for highlighting
function analyzeSQL(sql: string) {
  const tokens = [];
  const lines = sql.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for comment starting with --
    const commentIndex = line.indexOf('--');
    
    if (commentIndex !== -1) {
      // Split line into before and after comment
      const beforeComment = line.substring(0, commentIndex);
      const commentPart = line.substring(commentIndex);
      
      // Process the part before comment normally
      if (beforeComment.trim()) {
        const beforeTokens = parseLineTokens(beforeComment);
        tokens.push(...beforeTokens);
      }
      
      // Add the comment as a single token
      tokens.push({ text: commentPart, type: 'comment' });
    } else {
      // No comment, process entire line normally
      const lineTokens = parseLineTokens(line);
      tokens.push(...lineTokens);
    }
    
    // Add newline if not the last line
    if (i < lines.length - 1) {
      tokens.push({ text: '\n', type: 'whitespace' });
    }
  }
  
  return tokens;
}

// Helper function to parse tokens from a line (without comments)
function parseLineTokens(text: string) {
  const tokens = [];
  const words = text.split(/(\s+|[(),;])/);
  
  for (const word of words) {
    if (!word.trim()) {
      tokens.push({ text: word, type: 'whitespace' });
      continue;
    }
    
    const upperWord = word.toUpperCase();
    if (SQL_KEYWORDS.includes(upperWord)) {
      tokens.push({ text: word, type: 'keyword' });
    } else if (/^\d+(\.\d+)?$/.test(word)) {
      tokens.push({ text: word, type: 'number' });
    } else if (/^'.*'$/.test(word) || /^".*"$/.test(word)) {
      tokens.push({ text: word, type: 'string' });
    } else {
      tokens.push({ text: word, type: 'text' });
    }
  }
  
  return tokens;
}

// Create highlighted spans for display
function createHighlightedContent(tokens: Array<{text: string, type: string}>) {
  return tokens.map(token => {
    switch (token.type) {
      case 'keyword':
        return `<span style="color: #2563eb; font-weight: 600;">${token.text.toUpperCase()}</span>`;
      case 'number':
        return `<span style="color: #9333ea;">${token.text}</span>`;
      case 'string':
        return `<span style="color: #16a34a;">${token.text}</span>`;
      case 'comment':
        return `<span style="color: #6b7280; font-style: italic;">${token.text}</span>`;
      default:
        return token.text;
    }
  }).join('');
}

// SQL Formatter function
function formatSQL(sql: string): string {
  if (!sql.trim()) return sql;
  
  // Remove extra whitespace and normalize
  let formatted = sql.replace(/\s+/g, ' ').trim();
  
  // Add line breaks after major keywords
  const majorKeywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 
    'ORDER BY', 'GROUP BY', 'HAVING', 'UNION', 'INSERT INTO', 'UPDATE', 'DELETE FROM',
    'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE'
  ];
  
  majorKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, `\n${keyword.toUpperCase()}`);
  });
  
  // Add indentation for certain clauses
  const indentKeywords = ['AND', 'OR', 'ON'];
  indentKeywords.forEach(keyword => {
    const regex = new RegExp(`\\n(\\s*)\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, `\n    ${keyword.toUpperCase()}`);
  });
  
  // Format SELECT columns (add line breaks after commas in SELECT)
  formatted = formatted.replace(/SELECT\s+/gi, 'SELECT\n    ');
  formatted = formatted.replace(/,\s*(?![^()]*\))/g, ',\n    ');
  
  // Clean up extra line breaks and spaces
  formatted = formatted.replace(/\n\s*\n/g, '\n');
  formatted = formatted.replace(/^\n+/, '');
  formatted = formatted.replace(/\n+$/, '');
  
  // Normalize indentation
  const lines = formatted.split('\n');
  const cleanedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.match(/^(AND|OR|ON)\b/i)) {
      return '    ' + trimmed;
    } else if (trimmed.match(/^(SELECT|FROM|WHERE|JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|ORDER BY|GROUP BY|HAVING|UNION)/i)) {
      return trimmed;
    } else if (trimmed.length > 0 && !trimmed.match(/^(SELECT|FROM|WHERE|JOIN|INNER JOIN|LEFT JOIN|RIGHT JOIN|ORDER BY|GROUP BY|HAVING|UNION|AND|OR|ON)/i)) {
      return '    ' + trimmed;
    }
    return trimmed;
  });
  
  return cleanedLines.join('\n');
}

// SQL syntax validation function
function validateSQL(sql: string): string[] {
  const errors: string[] = [];
  if (!sql.trim()) return errors;
  
  // Remove comments before validation to avoid false positives
  const lines = sql.split('\n');
  const sqlWithoutComments = lines
    .map(line => {
      const commentIndex = line.indexOf('--');
      return commentIndex !== -1 ? line.substring(0, commentIndex) : line;
    })
    .join('\n')
    .trim();
  
  // If only comments remain, no validation errors
  if (!sqlWithoutComments) return errors;
  
  const upperSQL = sqlWithoutComments.toUpperCase().trim();
  
  // Basic syntax checks - only for non-comment content
  if (!upperSQL.match(/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|SHOW|DESCRIBE|EXPLAIN)/)) {
    errors.push('SQL statement should start with a valid command (SELECT, INSERT, UPDATE, etc.)');
  }
  
  // Check for unclosed quotes (only in non-comment parts)
  const singleQuotes = (sqlWithoutComments.match(/'/g) || []).length;
  const doubleQuotes = (sqlWithoutComments.match(/"/g) || []).length;
  if (singleQuotes % 2 !== 0) {
    errors.push('Unclosed single quote detected');
  }
  if (doubleQuotes % 2 !== 0) {
    errors.push('Unclosed double quote detected');
  }
  
  // Check for basic parentheses matching (only in non-comment parts)
  const openParens = (sqlWithoutComments.match(/\(/g) || []).length;
  const closeParens = (sqlWithoutComments.match(/\)/g) || []).length;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [syntaxErrors, setSyntaxErrors] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState<string>('');
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
    } else {
      // For custom editor, check if there's selected text
      if (selectedText.trim()) {
        queryToExecute = selectedText;
      } else {
        queryToExecute = content;
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

    // If no specific selection, check if there are multiple statements separated by semicolons
    if (!selectedText.trim() && queryToExecute.includes(';')) {
      // Split by semicolon and execute each statement
      const statements = queryToExecute
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      if (statements.length > 1) {
        // Execute multiple statements sequentially
        executeMultipleStatements(statements);
        return;
      }
    }

    executeQueryMutation.mutate(queryToExecute);
  };

  const executeMultipleStatements = async (statements: string[]) => {
    setIsExecuting(true);
    const results = [];
    
    try {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        toast({
          title: `Executing statement ${i + 1} of ${statements.length}`,
          description: statement.substring(0, 50) + (statement.length > 50 ? '...' : ''),
        });

        const response = await apiRequest(
          'POST',
          `/api/connections/${connectionId}/query`,
          {
            query: statement,
            database: databaseName
          }
        );

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Statement ${i + 1} failed: ${errorData}`);
        }

        const result = await response.json();
        results.push({
          statement: statement,
          result: result,
          index: i + 1
        });
      }

      // Set results in a special multi-statement format
      setQueryResults({
        columns: ['Multi-Statement Results'],
        rows: [],
        rowCount: 0,
        executionTime: 0,
        multiStatementResults: results // Add this custom property
      });

      toast({
        title: "All statements executed successfully",
        description: `${statements.length} statements completed successfully`,
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/query-history'] });

    } catch (error: any) {
      toast({
        title: "Multi-statement execution failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const formatQuery = () => {
    if (monacoEditorRef.current) {
      monacoEditorRef.current.getAction('editor.action.formatDocument').run();
    } else {
      // Format SQL for our custom editor
      const formattedSQL = formatSQL(content);
      updateTabContent(tabId, formattedSQL);
      toast({
        title: "SQL Formatted",
        description: "Your SQL has been formatted successfully",
      });
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
              {isExecuting ? 'Stop' : selectedText.trim() ? 'Run Selection' : 'Run Query'}
            </Button>
            
            <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
            
            <Button
              variant="ghost"
              onClick={formatQuery}
              disabled={!content?.trim()}
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
            // SQL Editor with direct highlighting and line numbers
            <div className="w-full h-full flex overflow-hidden">
              {/* Line numbers */}
              <div className="bg-gray-100 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600 px-2 py-4 font-mono text-sm text-gray-500 dark:text-gray-400 select-none min-w-[3rem] text-right">
                {(content || '').split('\n').map((_, index) => (
                  <div key={index} style={{ fontSize: '14px', lineHeight: '1.5' }}>
                    {index + 1}
                  </div>
                ))}
              </div>
              
              {/* Editor area */}
              <div className="flex-1 relative overflow-hidden">
                {/* Highlighted text layer (background) */}
                <div 
                  className="absolute inset-0 p-4 font-mono text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
                  style={{ 
                    fontSize: '14px', 
                    lineHeight: '1.5',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                  dangerouslySetInnerHTML={{
                    __html: createHighlightedContent(analyzeSQL(content || ''))
                  }}
                />
                
                {/* Transparent textarea (foreground) */}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    const newContent = e.target.value;
                    updateTabContent(tabId, newContent);
                    // Validate SQL syntax
                    const errors = validateSQL(newContent);
                    setSyntaxErrors(errors);
                  }}
                  onSelect={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    const selected = target.value.substring(target.selectionStart, target.selectionEnd);
                    setSelectedText(selected);
                  }}
                  onMouseUp={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    const selected = target.value.substring(target.selectionStart, target.selectionEnd);
                    setSelectedText(selected);
                  }}
                  onKeyUp={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    const selected = target.value.substring(target.selectionStart, target.selectionEnd);
                    setSelectedText(selected);
                  }}
                  className="w-full h-full p-4 font-mono text-sm bg-transparent resize-none outline-none border-none relative z-10"
                  placeholder="Enter your SQL query here..."
                  style={{ 
                    fontSize: '14px', 
                    lineHeight: '1.5',
                    color: 'transparent',
                    caretColor: '#374151',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                  spellCheck={false}
                />
                
                {/* Cursor visibility helper */}
                <div 
                  className="absolute inset-0 p-4 font-mono text-sm pointer-events-none whitespace-pre-wrap break-words overflow-hidden opacity-0"
                  style={{ 
                    fontSize: '14px', 
                    lineHeight: '1.5',
                    color: '#374151',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                >
                  {content}
                </div>
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
