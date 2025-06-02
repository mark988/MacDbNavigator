import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit2, Save, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { TableColumn } from '@shared/schema';

interface TableStructureViewProps {
  tableName: string;
  connectionId: number;
  databaseName: string;
}

export function TableStructureView({ tableName, connectionId, databaseName }: TableStructureViewProps) {
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<TableColumn>>({});
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

  const handleEditColumn = (column: TableColumn) => {
    setEditingColumn(column.name);
    setEditingValues({
      name: column.name,
      type: column.type,
      nullable: column.nullable,
      default: column.default,
    });
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
          <CardTitle className="flex items-center text-lg">
            <Table className="w-5 h-5 mr-2" />
            表结构: {tableName}
          </CardTitle>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            数据库: {databaseName} | 字段数量: {tableStructure.columns?.length || 0}
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
                      <select
                        value={editingValues.type || ''}
                        onChange={(e) => setEditingValues({ ...editingValues, type: e.target.value })}
                        className="px-2 py-1 border rounded w-40 text-sm bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
                      >
                        <option value="">选择数据类型</option>
                        {postgresqlDataTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditColumn(column)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}