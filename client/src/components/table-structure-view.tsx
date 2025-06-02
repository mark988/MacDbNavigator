import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Save, X, Plus, Trash2, Table as TableIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { TableColumn } from '@shared/schema';

interface TableStructureViewProps {
  tableName: string;
  connectionId: number;
  databaseName: string;
}

interface EditingValues extends Partial<TableColumn> {
  baseType?: string;
}

interface NewColumnData {
  name: string;
  type: string;
  baseType: string;
  nullable: boolean;
  default: string;
}

export function TableStructureView({ tableName, connectionId, databaseName }: TableStructureViewProps) {
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<EditingValues>({});
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnData, setNewColumnData] = useState<NewColumnData>({
    name: '',
    type: '',
    baseType: '',
    nullable: true,
    default: ''
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // PostgreSQL常用数据类型列表
  const postgresqlDataTypes = [
    'integer',
    'bigint',
    'smallint',
    'numeric',
    'decimal',
    'real',
    'double precision',
    'character varying',
    'varchar',
    'character',
    'char',
    'text',
    'boolean',
    'date',
    'time',
    'timestamp',
    'timestamptz',
    'interval',
    'uuid',
    'json',
    'jsonb',
    'bytea'
  ];

  const { data: tableStructure, isLoading } = useQuery({
    queryKey: ['/api/connections', connectionId, 'tables', tableName, 'columns', databaseName],
    queryFn: async () => {
      const response = await fetch(`/api/connections/${connectionId}/tables/${tableName}/columns?database=${databaseName}`);
      if (!response.ok) {
        throw new Error('Failed to fetch table structure');
      }
      return response.json();
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async (data: { columnName: string; changes: Partial<TableColumn> }) => {
      const response = await apiRequest(
        'POST',
        `/api/connections/${connectionId}/table/${tableName}/alter-column`,
        {
          columnName: data.columnName,
          changes: data.changes,
          database: databaseName
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/connections', connectionId, 'tables', tableName, 'columns'] 
      });
      toast({
        title: "字段更新成功",
        description: "表结构已成功修改",
        duration: 3000,
      });
      setEditingColumn(null);
      setEditingValues({});
    },
    onError: (error: any) => {
      toast({
        title: "更新失败",
        description: error.message || "修改表结构时发生错误",
        variant: "destructive",
      });
    },
  });

  const addColumnMutation = useMutation({
    mutationFn: async (columnData: { name: string; type: string; nullable: boolean; default?: string }) => {
      const response = await apiRequest(
        'POST',
        `/api/connections/${connectionId}/table/${tableName}/add-column`,
        {
          columnData,
          database: databaseName
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/connections', connectionId, 'tables', tableName, 'columns'] 
      });
      toast({
        title: "字段添加成功",
        description: "新字段已成功添加到表中",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "添加失败",
        description: error.message || "添加字段时发生错误",
        variant: "destructive",
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnName: string) => {
      const response = await apiRequest(
        'DELETE',
        `/api/connections/${connectionId}/table/${tableName}/column/${columnName}`,
        {
          database: databaseName
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/connections', connectionId, 'tables', tableName, 'columns'] 
      });
      toast({
        title: "字段删除成功",
        description: "字段已成功从表中删除",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "删除失败",
        description: error.message || "删除字段时发生错误",
        variant: "destructive",
      });
    },
  });

  const handleEditColumn = (column: TableColumn) => {
    setEditingColumn(column.name);
    
    // Extract base type from full type definition
    let baseType = '';
    const typeStr = column.type.toLowerCase();
    if (typeStr.includes('character varying') || typeStr.startsWith('varchar')) {
      baseType = 'varchar';
    } else if (typeStr.includes('character') || typeStr.startsWith('char(')) {
      baseType = 'char';
    } else if (typeStr.startsWith('numeric') || typeStr.startsWith('decimal')) {
      baseType = typeStr.startsWith('numeric') ? 'numeric' : 'decimal';
    } else {
      // For simple types without parentheses, extract the base type
      baseType = typeStr.split('(')[0];
    }
    
    setEditingValues({
      name: column.name,
      type: column.type,
      baseType: baseType,
      nullable: column.nullable,
      default: column.default,
    } as EditingValues);
  };

  const handleSaveColumn = () => {
    if (!editingColumn) return;
    
    updateColumnMutation.mutate({
      columnName: editingColumn,
      changes: editingValues
    });
  };

  const handleCancelEdit = () => {
    setEditingColumn(null);
    setEditingValues({});
  };

  const handleAddColumn = () => {
    if (!newColumnData.name || !newColumnData.type) {
      toast({
        title: "信息不完整",
        description: "请填写字段名称和数据类型",
        variant: "destructive",
      });
      return;
    }

    addColumnMutation.mutate({
      name: newColumnData.name,
      type: newColumnData.type,
      nullable: newColumnData.nullable,
      default: newColumnData.default || undefined
    });

    setIsAddingColumn(false);
    setNewColumnData({
      name: '',
      type: '',
      baseType: '',
      nullable: true,
      default: ''
    });
  };

  const handleDeleteColumn = (columnName: string) => {
    if (confirm(`确定要删除字段 "${columnName}" 吗？此操作无法撤销。`)) {
      deleteColumnMutation.mutate(columnName);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!tableStructure) {
    return (
      <div className="p-6 text-center text-gray-500">
        无法加载表结构信息
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center text-lg">
                <TableIcon className="w-5 h-5 mr-2" />
                表结构: {tableName}
              </CardTitle>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                数据库: {databaseName} | 字段数量: {tableStructure.columns?.length || 0}
              </div>
            </div>
            <Button
              onClick={() => setIsAddingColumn(true)}
              disabled={isAddingColumn}
              size="sm"
              className="flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              新增字段
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>字段名</TableHead>
                <TableHead>数据类型</TableHead>
                <TableHead>允许空值</TableHead>
                <TableHead>默认值</TableHead>
                <TableHead>键类型</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableStructure.columns?.map((column: TableColumn) => (
                <TableRow key={column.name}>
                  <TableCell className="font-medium">
                    {editingColumn === column.name ? (
                      <Input
                        value={editingValues.name || ''}
                        onChange={(e) => setEditingValues({ ...editingValues, name: e.target.value })}
                        className="w-32"
                      />
                    ) : (
                      column.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingColumn === column.name ? (
                      <div className="flex flex-col space-y-1">
                        <select
                          value={editingValues.baseType || ''}
                          onChange={(e) => {
                            const baseType = e.target.value;
                            let fullType = baseType;
                            
                            // Add default length for types that commonly need it
                            if (baseType === 'varchar' || baseType === 'character varying') {
                              fullType = `${baseType}(255)`;
                            } else if (baseType === 'char' || baseType === 'character') {
                              fullType = `${baseType}(1)`;
                            } else if (baseType === 'numeric' || baseType === 'decimal') {
                              fullType = `${baseType}(10,2)`;
                            }
                            
                            setEditingValues({ 
                              ...editingValues, 
                              baseType: baseType,
                              type: fullType 
                            } as EditingValues);
                          }}
                          className="px-2 py-1 border rounded w-40 text-sm bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
                        >
                          <option value="">选择基础类型</option>
                          {postgresqlDataTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={editingValues.type || ''}
                          onChange={(e) => setEditingValues({ ...editingValues, type: e.target.value })}
                          className="w-40 text-sm"
                          placeholder="如: varchar(255), numeric(10,2)"
                        />
                      </div>
                    ) : (
                      <Badge variant="outline">{column.type}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingColumn === column.name ? (
                      <select
                        value={editingValues.nullable ? 'true' : 'false'}
                        onChange={(e) => setEditingValues({ ...editingValues, nullable: e.target.value === 'true' })}
                        className="px-2 py-1 border rounded bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
                      >
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    ) : (
                      <Badge variant={column.nullable ? "secondary" : "destructive"}>
                        {column.nullable ? '是' : '否'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingColumn === column.name ? (
                      <Input
                        value={editingValues.default || ''}
                        onChange={(e) => setEditingValues({ ...editingValues, default: e.target.value })}
                        className="w-32"
                        placeholder="默认值"
                      />
                    ) : (
                      column.default || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {column.key && (
                      <Badge variant="default">{column.key}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingColumn === column.name ? (
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          onClick={handleSaveColumn}
                          disabled={updateColumnMutation.isPending}
                        >
                          <Save className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditColumn(column)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteColumn(column.name)}
                          disabled={deleteColumnMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {isAddingColumn && (
                <TableRow className="bg-blue-50 dark:bg-blue-900/20">
                  <TableCell>
                    <Input
                      value={newColumnData.name}
                      onChange={(e) => setNewColumnData({ ...newColumnData, name: e.target.value })}
                      placeholder="字段名称"
                      className="w-32"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      <select
                        value={newColumnData.baseType}
                        onChange={(e) => {
                          const baseType = e.target.value;
                          let fullType = baseType;
                          
                          if (baseType === 'varchar' || baseType === 'character varying') {
                            fullType = `${baseType}(255)`;
                          } else if (baseType === 'char' || baseType === 'character') {
                            fullType = `${baseType}(1)`;
                          } else if (baseType === 'numeric' || baseType === 'decimal') {
                            fullType = `${baseType}(10,2)`;
                          }
                          
                          setNewColumnData({ 
                            ...newColumnData, 
                            baseType: baseType,
                            type: fullType 
                          });
                        }}
                        className="px-2 py-1 border rounded w-40 text-sm bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
                      >
                        <option value="">选择基础类型</option>
                        {postgresqlDataTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <Input
                        value={newColumnData.type}
                        onChange={(e) => setNewColumnData({ ...newColumnData, type: e.target.value })}
                        className="w-40 text-sm"
                        placeholder="如: varchar(255), numeric(10,2)"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      value={newColumnData.nullable ? 'true' : 'false'}
                      onChange={(e) => setNewColumnData({ ...newColumnData, nullable: e.target.value === 'true' })}
                      className="px-2 py-1 border rounded bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
                    >
                      <option value="true">是</option>
                      <option value="false">否</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={newColumnData.default}
                      onChange={(e) => setNewColumnData({ ...newColumnData, default: e.target.value })}
                      className="w-32"
                      placeholder="默认值"
                    />
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        onClick={handleAddColumn}
                        disabled={addColumnMutation.isPending}
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsAddingColumn(false);
                          setNewColumnData({
                            name: '',
                            type: '',
                            baseType: '',
                            nullable: true,
                            default: ''
                          });
                        }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}