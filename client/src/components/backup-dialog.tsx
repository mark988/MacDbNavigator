import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface BackupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  connectionId: number;
  databaseName: string;
}

export function BackupDialog({ 
  open, 
  onOpenChange, 
  tableName, 
  connectionId, 
  databaseName 
}: BackupDialogProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'backing-up' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  const backupMutation = useMutation({
    mutationFn: async () => {
      setStatus('backing-up');
      setProgress(10);

      // 模拟备份进度
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await apiRequest(
        'POST',
        `/api/connections/${connectionId}/backup`,
        {
          tableName,
          database: databaseName,
          format: 'sql'
        }
      );

      clearInterval(progressInterval);
      setProgress(100);

      // 创建下载链接
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // 生成文件名：表名_年-月-日-时分秒.sql
      const now = new Date();
      const timestamp = now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0') + '-' + 
                       String(now.getHours()).padStart(2, '0') + 
                       String(now.getMinutes()).padStart(2, '0') + 
                       String(now.getSeconds()).padStart(2, '0');
      
      a.download = `${tableName}_${timestamp}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setStatus('success');
      return response;
    },
    onSuccess: () => {
      toast({
        title: "备份成功",
        description: `表 "${tableName}" 已成功备份并下载`,
        duration: 3000,
      });
      setTimeout(() => {
        onOpenChange(false);
        setStatus('idle');
        setProgress(0);
      }, 2000);
    },
    onError: (error: any) => {
      setStatus('error');
      toast({
        title: "备份失败",
        description: error.message || "备份过程中发生错误",
        variant: "destructive",
      });
    },
  });

  const handleStartBackup = () => {
    backupMutation.mutate();
  };

  const handleClose = () => {
    if (status !== 'backing-up') {
      onOpenChange(false);
      setStatus('idle');
      setProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Download className="w-5 h-5 mr-2" />
            备份表数据
          </DialogTitle>
          <DialogDescription>
            备份表 "{tableName}" 的数据到SQL文件
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'idle' && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>• 数据库: {databaseName}</p>
              <p>• 表名: {tableName}</p>
              <p>• 格式: SQL</p>
            </div>
          )}

          {status === 'backing-up' && (
            <div className="space-y-3">
              <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></div>
                正在备份数据...
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-gray-500 text-center">{progress}% 完成</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="w-4 h-4 mr-2" />
              备份完成！文件已开始下载
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mr-2" />
              备份失败，请重试
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={status === 'backing-up'}
            >
              取消
            </Button>
            <Button
              onClick={handleStartBackup}
              disabled={status === 'backing-up' || status === 'success'}
            >
              {status === 'backing-up' ? '备份中...' : '开始备份'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}