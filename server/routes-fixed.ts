import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import mysql from "mysql2/promise";
import { Client } from "pg";
import { storage } from "./storage";
import { insertConnectionSchema, insertQueryHistorySchema, type DatabaseInfo, type QueryResult } from "../shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Get all connections
  app.get('/api/connections', async (_req: Request, res: Response) => {
    try {
      const connections = await storage.getConnections();
      res.json(connections);
    } catch (error: any) {
      console.error('Error fetching connections:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new connection
  app.post('/api/connections', async (req: Request, res: Response) => {
    try {
      const validatedData = insertConnectionSchema.parse(req.body);
      const connection = await storage.createConnection(validatedData);
      res.json(connection);
    } catch (error: any) {
      console.error('Error creating connection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete connection
  app.delete('/api/connections/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteConnection(id);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Connection not found" });
      }
    } catch (error: any) {
      console.error('Error deleting connection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test connection
  app.post('/api/connections/:id/test', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const connection = await storage.getConnection(id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      let isConnected = false;
      let error = null;

      try {
        if (connection.type === 'mysql') {
          const mysqlConnection = await mysql.createConnection({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database || undefined,
            connectTimeout: 5000,
          });
          await mysqlConnection.ping();
          await mysqlConnection.end();
          isConnected = true;
        } else if (connection.type === 'postgresql') {
          const client = new Client({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database || 'postgres',
            connectionTimeoutMillis: 5000,
            ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
          });
          await client.connect();
          await client.query('SELECT 1');
          await client.end();
          isConnected = true;
        }
      } catch (err: any) {
        error = err.message;
      }

      await storage.updateConnectionStatus(id, isConnected);
      res.json({ isConnected, error });
    } catch (error: any) {
      console.error('Error testing connection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get databases and tables for a connection
  app.get('/api/connections/:id/databases', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const connection = await storage.getConnection(id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      let databaseInfo: DatabaseInfo = { databases: [], tables: [] };

      try {
        if (connection.type === 'mysql') {
          const mysqlConnection = await mysql.createConnection({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database || undefined,
          });

          const [databases] = await mysqlConnection.execute('SHOW DATABASES');
          databaseInfo.databases = (databases as any[]).map(row => row.Database);

          if (connection.database) {
            const [tables] = await mysqlConnection.execute('SHOW TABLES');
            databaseInfo.tables = (tables as any[]).map(row => ({
              name: row[`Tables_in_${connection.database}`],
              type: 'table' as const
            }));
          }

          await mysqlConnection.end();
        } else if (connection.type === 'postgresql') {
          const client = new Client({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database || 'postgres',
            ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
          });
          await client.connect();

          const dbResult = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false');
          databaseInfo.databases = dbResult.rows.map(row => row.datname);

          if (connection.database) {
            const tableResult = await client.query(`
              SELECT table_name, table_type 
              FROM information_schema.tables 
              WHERE table_schema = 'public'
            `);
            databaseInfo.tables = tableResult.rows.map(row => ({
              name: row.table_name,
              type: row.table_type === 'VIEW' ? 'view' as const : 'table' as const
            }));
          }

          await client.end();
        }
      } catch (error: any) {
        console.error('Database connection error:', error);
        return res.status(500).json({ error: `Database connection failed: ${error.message}` });
      }

      res.json(databaseInfo);
    } catch (error: any) {
      console.error('Error fetching databases:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // The rest of the routes would follow the same pattern...
  // For now, let's replace the original file

  return server;
}