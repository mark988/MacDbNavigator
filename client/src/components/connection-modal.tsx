import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { insertConnectionSchema, type InsertConnection } from '@shared/schema';
import { useDatabaseStore } from '@/lib/database-store';
import { useToast } from '@/hooks/use-toast';

type ConnectionFormData = InsertConnection;

export function ConnectionModal() {
  const { isConnectionModalOpen, setConnectionModalOpen } = useDatabaseStore();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(insertConnectionSchema),
    defaultValues: {
      name: '',
      type: 'postgresql',
      host: 'localhost',
      port: 5432,
      database: '',
      username: '',
      password: '',
      useSSL: false,
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (data: ConnectionFormData) => {
      const response = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create connection');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Connection created",
        description: "Database connection has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      setConnectionModalOpen(false);
      form.reset();
      setTestStatus('idle');
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create connection",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const testConnection = async () => {
    const formData = form.getValues();
    
    // Validate required fields (database is now optional)
    const requiredFields: (keyof ConnectionFormData)[] = ['name', 'host', 'username'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setTestStatus('testing');
    setTestError('');

    try {
      // Create a unique test connection name to avoid conflicts
      const testFormData = {
        ...formData,
        name: `__TEST__${formData.name}__${Date.now()}`
      };

      // First create a temporary connection to test
      const tempConnection = await fetch('/api/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testFormData),
      });

      if (!tempConnection.ok) {
        const error = await tempConnection.json();
        throw new Error(error.error || 'Failed to create connection');
      }

      const connection = await tempConnection.json();

      try {
        // Test the connection
        const testResponse = await fetch(`/api/connections/${connection.id}/test`, {
          method: 'POST',
        });

        const testResult = await testResponse.json();

        if (testResult.connected) {
          setTestStatus('success');
          toast({
            title: "Connection successful",
            description: "Successfully connected to the database",
          });
        } else {
          setTestStatus('error');
          setTestError(testResult.error || 'Connection failed');
          toast({
            title: "Connection failed",
            description: testResult.error || 'Unable to connect to the database',
            variant: "destructive",
          });
        }
      } finally {
        // Always clean up the temporary connection
        await fetch(`/api/connections/${connection.id}`, {
          method: 'DELETE',
        });
        // Refresh the connections list to remove any temporary entries
        queryClient.invalidateQueries({ queryKey: ['/api/connections'] });
      }

    } catch (error: any) {
      setTestStatus('error');
      setTestError(error.message || 'Connection test failed');
      toast({
        title: "Connection test failed",
        description: error.message || 'Unable to test the connection',
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: ConnectionFormData) => {
    createConnectionMutation.mutate(data);
  };

  const handleClose = () => {
    setConnectionModalOpen(false);
    form.reset();
    setTestStatus('idle');
    setTestError('');
  };

  return (
    <Dialog open={isConnectionModalOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" aria-describedby="connection-modal-description">
        <DialogHeader>
          <DialogTitle>New Database Connection</DialogTitle>
          <div id="connection-modal-description" className="sr-only">
            Create a new database connection by entering your database credentials
          </div>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Connection Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Database" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Type</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select database type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mysql">MySQL</SelectItem>
                        <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input placeholder="localhost" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="3306" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="database"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Database Name</FormLabel>
                  <FormControl>
                    <Input placeholder="mydb" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="root" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SSL Option */}
            <FormField
              control={form.control}
              name="useSSL"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value || false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Use SSL Connection
                    </FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Enable SSL/TLS encryption for secure database connections
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {/* Test Connection Status */}
            {testStatus !== 'idle' && (
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                {testStatus === 'testing' && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Testing connection...</span>
                  </>
                )}
                {testStatus === 'success' && (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-green-700 dark:text-green-400">
                      Connection successful
                    </span>
                  </>
                )}
                {testStatus === 'error' && (
                  <>
                    <XCircle className="w-4 h-4 text-red-500" />
                    <div className="flex-1">
                      <div className="text-sm text-red-700 dark:text-red-400">
                        Connection failed
                      </div>
                      {testError && (
                        <div className="text-xs text-red-600 dark:text-red-500 mt-1">
                          {testError}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                disabled={testStatus === 'testing'}
                className="flex items-center"
              >
                {testStatus === 'testing' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Test Connection
              </Button>
              
              <div className="flex space-x-3">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createConnectionMutation.isPending}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  {createConnectionMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Connect
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
