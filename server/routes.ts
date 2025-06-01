import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConnectionSchema, insertQueryHistorySchema, type QueryResult, type DatabaseInfo } from "@shared/schema";
import mysql from 'mysql2/promise';
import { Client } from 'pg';

export async function registerRoutes(app: Express): Promise<Server> {
  // Connection management routes
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const validatedData = insertConnectionSchema.parse(req.body);
      const connection = await storage.createConnection(validatedData);
      res.json(connection);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create connection" });
    }
  });

  app.put("/api/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertConnectionSchema.partial().parse(req.body);
      const connection = await storage.updateConnection(id, validatedData);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update connection" });
    }
  });

  // Update connection
  app.put("/api/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertConnectionSchema.parse(req.body);
      const connection = await storage.updateConnection(id, validatedData);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json(connection);
    } catch (error: any) {
      console.error('Error updating connection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteConnection(id);
      if (!success) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  // Database operations
  app.post("/api/connections/:id/test", async (req, res) => {
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
      res.json({ connected: isConnected, error });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to test connection" });
    }
  });

  app.get("/api/connections/:id/databases", async (req, res) => {
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

          const dbResult = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN (\'template0\', \'template1\')');
          databaseInfo.databases = dbResult.rows
            .map(row => row.datname)
            .filter(name => name && name.trim());

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
      } catch (err: any) {
        return res.status(500).json({ error: `Database connection failed: ${err.message}` });
      }

      res.json(databaseInfo);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch database info" });
    }
  });

  // Get tables for a specific database
  app.get('/api/connections/:id/databases/:dbName/tables', async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const dbName = req.params.dbName;
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      let tables: any[] = [];

      try {
        if (connection.type === 'mysql') {
          const mysqlConnection = mysql.createConnection({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: dbName,
          });

          const [tablesResult] = await mysqlConnection.execute('SHOW TABLES');
          tables = (tablesResult as any[]).map(row => ({
            name: row[`Tables_in_${dbName}`],
            type: 'table' as const
          }));

          await mysqlConnection.end();
        } else if (connection.type === 'postgresql') {
          const client = new Client({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: dbName,
            ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
          });
          await client.connect();

          const tableResult = await client.query(`
            SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
          `);
          tables = tableResult.rows.map(row => ({
            name: row.table_name,
            type: row.table_type === 'VIEW' ? 'view' : 'table'
          }));

          await client.end();
        }
      } catch (err: any) {
        return res.status(500).json({ error: `Failed to get tables: ${err.message}` });
      }

      res.json({ tables });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch tables" });
    }
  });

  // Get table structure/columns
  app.get("/api/connections/:id/tables/:tableName/columns", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tableName = req.params.tableName;
      const connection = await storage.getConnection(id);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      let columns: any[] = [];

      try {
        if (connection.type === 'mysql') {
          const mysqlConnection = await mysql.createConnection({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database,
          });

          const [result] = await mysqlConnection.execute(`DESCRIBE ${tableName}`);
          columns = (result as any[]).map(row => ({
            name: row.Field,
            type: row.Type,
            nullable: row.Null === 'YES',
            key: row.Key,
            default: row.Default,
            extra: row.Extra
          }));

          await mysqlConnection.end();
        } else if (connection.type === 'postgresql') {
          const client = new Client({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database,
            ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
          });
          await client.connect();

          const result = await client.query(`
            SELECT 
              column_name as name,
              data_type as type,
              is_nullable = 'YES' as nullable,
              column_default as default_value,
              character_maximum_length,
              numeric_precision,
              numeric_scale
            FROM information_schema.columns 
            WHERE table_name = $1 
            AND table_schema = 'public'
            ORDER BY ordinal_position
          `, [tableName]);

          columns = result.rows.map(row => ({
            name: row.name,
            type: row.type,
            nullable: row.nullable,
            default: row.default_value,
            maxLength: row.character_maximum_length,
            precision: row.numeric_precision,
            scale: row.numeric_scale
          }));

          await client.end();
        }
      } catch (err: any) {
        return res.status(500).json({ error: `Failed to fetch table structure: ${err.message}` });
      }

      res.json({ tableName, columns });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch table structure" });
    }
  });

  // Table data update endpoint
  app.post('/api/connections/:id/table/:tableName/update', async (req: Request, res: Response) => {
    try {
      const connectionId = parseInt(req.params.id);
      const { tableName } = req.params;
      const { changes, originalData, database, schema, fullQuery } = req.body;

      console.log('Update request data:', {
        connectionId,
        tableName,
        database,
        schema,
        fullQuery,
        changesCount: changes?.length
      });

      const connection = await storage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      if (connection.type === 'mysql') {
        const mysqlConnection = await mysql.createConnection({
          host: connection.host,
          port: connection.port,
          user: connection.username,
          password: connection.password,
          database: connection.database,
        });
        
        for (const change of changes) {
          const { rowIndex, column, newValue, oldValue } = change;
          
          // Try to find a unique identifier for the row
          // First check if there's an 'id' column
          const originalRow = originalData[rowIndex];
          let whereClause = '';
          let whereValues = [];
          
          if (originalRow.id !== undefined) {
            whereClause = 'id = ?';
            whereValues = [originalRow.id];
          } else {
            // Build WHERE clause using all original values to uniquely identify the row
            const columns = Object.keys(originalRow);
            whereClause = columns.map(col => `\`${col}\` = ?`).join(' AND ');
            whereValues = columns.map(col => originalRow[col]);
          }
          
          const updateQuery = `UPDATE \`${tableName}\` SET \`${column}\` = ? WHERE ${whereClause}`;
          await mysqlConnection.execute(updateQuery, [newValue, ...whereValues]);
        }
        
        await mysqlConnection.end();
      } else if (connection.type === 'postgresql') {
        // Use the same database connection approach as the query endpoint
        const targetDatabase = database || connection.database || 'postgres';
        const client = new Client({
          host: connection.host,
          port: connection.port,
          user: connection.username,
          password: connection.password,
          database: targetDatabase,
          ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
        });
        
        // Override any environment variables that might interfere
        client.host = connection.host;
        client.port = connection.port;
        client.user = connection.username;
        client.password = connection.password;
        client.database = targetDatabase;
        
        await client.connect();
        
        // First, let's check what tables exist in the current database
        try {
          const allTablesQuery = `
            SELECT schemaname, tablename 
            FROM pg_tables 
            WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
            ORDER BY schemaname, tablename
          `;
          const allTablesResult = await client.query(allTablesQuery);
          console.log('All available tables:', allTablesResult.rows);
          
          // Also check the current database and schema
          const currentInfoQuery = `SELECT current_database(), current_schema()`;
          const currentInfo = await client.query(currentInfoQuery);
          console.log('Current database and schema:', currentInfo.rows[0]);
        } catch (err) {
          console.log('Error checking tables:', err);
        }
        
        for (const change of changes) {
          const { rowIndex, column, newValue, oldValue } = change;
          
          // Try to find a unique identifier for the row
          const originalRow = originalData[rowIndex];
          let whereClause = '';
          let whereValues = [];
          let paramIndex = 2; // Start from $2 since $1 is for the new value
          
          if (originalRow.id !== undefined) {
            whereClause = 'id = $2';
            whereValues = [originalRow.id];
          } else {
            // Build WHERE clause using all original values to uniquely identify the row
            const columns = Object.keys(originalRow);
            whereClause = columns.map(col => `"${col}" = $${paramIndex++}`).join(' AND ');
            whereValues = columns.map(col => originalRow[col]);
          }
          
          // Construct the full table name with schema if provided
          let fullTableName = tableName;
          if (schema) {
            fullTableName = `"${schema}"."${tableName}"`;
          } else {
            fullTableName = `"${tableName}"`;
          }
          
          const updateQuery = `UPDATE ${fullTableName} SET "${column}" = $1 WHERE ${whereClause}`;
          console.log('PostgreSQL Update Query:', updateQuery, 'Values:', [newValue, ...whereValues]);
          await client.query(updateQuery, [newValue, ...whereValues]);
        }
        
        await client.end();
      }

      res.json({ success: true, updatedRows: changes.length });
    } catch (error: any) {
      console.error('Table update error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/connections/:id/query", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { query, database } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query is required" });
      }

      const connection = await storage.getConnection(id);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      const startTime = Date.now();
      let result: QueryResult;

      try {
        if (connection.type === 'mysql') {
          const mysqlConnection = await mysql.createConnection({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: connection.database,
          });

          const [rows, fields] = await mysqlConnection.execute(query);
          const executionTime = Date.now() - startTime;

          result = {
            columns: (fields as any[]).map(field => field.name),
            rows: rows as Record<string, any>[],
            rowCount: Array.isArray(rows) ? rows.length : 0,
            executionTime,
          };

          await mysqlConnection.end();
        } else if (connection.type === 'postgresql') {
          const targetDatabase = database || connection.database || 'postgres';
          const client = new Client({
            host: connection.host,
            port: connection.port,
            user: connection.username,
            password: connection.password,
            database: targetDatabase,
            ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
          });
          
          // Override any environment variables that might interfere
          client.host = connection.host;
          client.port = connection.port;
          client.user = connection.username;
          client.password = connection.password;
          client.database = targetDatabase;
          
          await client.connect();

          const queryResult = await client.query(query);
          const executionTime = Date.now() - startTime;

          result = {
            columns: queryResult.fields.map(field => field.name),
            rows: queryResult.rows,
            rowCount: queryResult.rowCount || 0,
            executionTime,
          };

          await client.end();
        } else {
          throw new Error("Unsupported database type");
        }

        // Save to query history
        await storage.addQueryHistory({
          connectionId: id,
          query,
          executionTime: result.executionTime,
          rowCount: result.rowCount,
        });

        res.json(result);
      } catch (err: any) {
        const executionTime = Date.now() - startTime;
        
        // Save failed query to history
        await storage.addQueryHistory({
          connectionId: id,
          query,
          executionTime,
          rowCount: 0,
        });

        res.status(500).json({ error: `Query execution failed: ${err.message}` });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to execute query" });
    }
  });

  // Query history routes
  app.get("/api/query-history", async (req, res) => {
    try {
      const connectionId = req.query.connectionId ? parseInt(req.query.connectionId as string) : undefined;
      const history = await storage.getQueryHistory(connectionId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch query history" });
    }
  });

  app.delete("/api/query-history/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteQueryHistory(id);
      if (!success) {
        return res.status(404).json({ error: "Query history not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete query history" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
