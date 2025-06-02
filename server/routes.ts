import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertConnectionSchema, insertQueryHistorySchema, type QueryResult, type DatabaseInfo } from "@shared/schema";
import mysql from 'mysql2/promise';
import { Client } from 'pg';
import { createPostgreSQLClient } from './database-helper';

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

          const [tablesResult] = await mysqlConnection.promise().execute('SHOW TABLES');
          tables = (tablesResult as any[]).map(row => ({
            name: row[`Tables_in_${dbName}`],
            type: 'table' as const
          }));

          mysqlConnection.end();
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
      const dbName = req.query.database as string;
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
            database: dbName || connection.database || undefined,
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
            database: dbName || connection.database || undefined,
            ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
          });
          await client.connect();

          // Set search_path to include the target database schema
          if (dbName && dbName !== 'postgres') {
            await client.query(`SET search_path TO "${dbName}", public`);
          }

          // First, find the correct schema for the table
          const schemaQuery = await client.query(`
            SELECT table_schema 
            FROM information_schema.tables 
            WHERE table_name = $1 
            LIMIT 1
          `, [tableName]);

          let tableSchema = 'public';
          if (schemaQuery.rows.length > 0) {
            tableSchema = schemaQuery.rows[0].table_schema;
          }

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
            AND table_schema = $2
            ORDER BY ordinal_position
          `, [tableName, tableSchema]);

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
        // If database is provided in request, use it; otherwise fall back to connection default
        const targetDatabase = database || connection.database || 'xiaoying';
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

          // Set search_path to include the target database schema
          if (targetDatabase && targetDatabase !== 'postgres') {
            await client.query(`SET search_path TO "${targetDatabase}", public`);
          }

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

  // Alter table column endpoint
  app.post('/api/connections/:id/table/:tableName/alter-column', async (req: Request, res: Response) => {
    try {
      const connectionId = parseInt(req.params.id);
      const { tableName } = req.params;
      const { columnName, changes, database } = req.body;

      const connection = await storage.getConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      if (connection.type === 'postgresql') {
        // Create a new connection specifically for the target database
        const client = createPostgreSQLClient({
          ...connection,
          database: database || connection.database
        });
        
        await client.connect();

        // Set search_path to include the target database schema
        if (database && database !== 'postgres') {
          await client.query(`SET search_path TO "${database}", public`);
        }

        // Debug: Check current database and search path
        const dbResult = await client.query('SELECT current_database(), current_schemas(true)');
        console.log('Current database:', dbResult.rows[0]);
        
        // Debug: Check if table exists in any schema
        const tableExistsQuery = `
          SELECT schemaname, tablename 
          FROM pg_tables 
          WHERE tablename = $1
        `;
        const tableExistsResult = await client.query(tableExistsQuery, [tableName]);
        console.log('Table exists check:', tableExistsResult.rows);

        if (tableExistsResult.rows.length === 0) {
          await client.end();
          return res.status(404).json({ error: `Table ${tableName} not found in any schema` });
        }

        // Use the found schema
        const tableSchema = tableExistsResult.rows[0].schemaname;
        console.log(`Using schema: ${tableSchema} for table: ${tableName}`);

        // Build ALTER TABLE statements based on changes
        // Use schema-qualified table name
        const alterStatements = [];
        const qualifiedTableName = tableSchema === 'public' ? `"${tableName}"` : `"${tableSchema}"."${tableName}"`;
        
        // Only execute changes that are actually different
        if (changes.name && changes.name !== columnName) {
          alterStatements.push(`ALTER TABLE ${qualifiedTableName} RENAME COLUMN "${columnName}" TO "${changes.name}"`);
        }
        
        if (changes.type) {
          const currentColumnName = changes.name || columnName;
          alterStatements.push(`ALTER TABLE ${qualifiedTableName} ALTER COLUMN "${currentColumnName}" TYPE ${changes.type}`);
        }
        
        if (changes.hasOwnProperty('nullable')) {
          const currentColumnName = changes.name || columnName;
          if (changes.nullable) {
            alterStatements.push(`ALTER TABLE ${qualifiedTableName} ALTER COLUMN "${currentColumnName}" DROP NOT NULL`);
          } else {
            alterStatements.push(`ALTER TABLE ${qualifiedTableName} ALTER COLUMN "${currentColumnName}" SET NOT NULL`);
          }
        }
        
        if (changes.hasOwnProperty('default')) {
          const currentColumnName = changes.name || columnName;
          if (changes.default === '' || changes.default === null) {
            alterStatements.push(`ALTER TABLE ${qualifiedTableName} ALTER COLUMN "${currentColumnName}" DROP DEFAULT`);
          } else {
            alterStatements.push(`ALTER TABLE ${qualifiedTableName} ALTER COLUMN "${currentColumnName}" SET DEFAULT '${changes.default}'`);
          }
        }

        // Execute all ALTER statements
        for (const statement of alterStatements) {
          console.log('Executing:', statement);
          await client.query(statement);
        }

        await client.end();
        
        res.json({ success: true, message: 'Column altered successfully' });
      } else if (connection.type === 'mysql') {
        // MySQL implementation can be added here if needed
        res.status(400).json({ error: 'MySQL column alteration not implemented yet' });
      } else {
        res.status(400).json({ error: 'Unsupported database type' });
      }
    } catch (error: any) {
      console.error('Alter column error:', error);
      res.status(500).json({ error: error.message || 'Failed to alter column' });
    }
  });

  // 新增表字段
  app.post('/api/connections/:id/table/:tableName/add-column', async (req: Request, res: Response) => {
    const connectionId = parseInt(req.params.id);
    const tableName = req.params.tableName;
    const { columnData, database } = req.body;

    try {
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: '连接未找到' });
      }

      let client;
      
      if (connection.type === 'postgresql') {
        client = createPostgreSQLClient({
          ...connection,
          database: database || connection.database
        });
        
        await client.connect();

        // 构建ADD COLUMN语句
        let addColumnQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnData.name} ${columnData.type}`;
        
        if (!columnData.nullable) {
          addColumnQuery += ' NOT NULL';
        }
        
        if (columnData.default) {
          addColumnQuery += ` DEFAULT '${columnData.default}'`;
        }

        await client.query(addColumnQuery);
        await client.end();
        
        res.json({ success: true, message: '字段添加成功' });
      } else {
        res.status(400).json({ error: '暂不支持此数据库类型的字段添加' });
      }
    } catch (error: any) {
      console.error('添加表字段错误:', error);
      res.status(500).json({ 
        error: error.message || '添加表字段失败',
        details: error.toString()
      });
    }
  });

  // 删除表字段
  app.delete('/api/connections/:id/table/:tableName/column/:columnName', async (req: Request, res: Response) => {
    const connectionId = parseInt(req.params.id);
    const tableName = req.params.tableName;
    const columnName = req.params.columnName;
    const { database } = req.body;

    try {
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: '连接未找到' });
      }

      let client;
      
      if (connection.type === 'postgresql') {
        client = createPostgreSQLClient({
          ...connection,
          database: database || connection.database
        });
        
        await client.connect();

        const dropColumnQuery = `ALTER TABLE ${tableName} DROP COLUMN ${columnName}`;
        await client.query(dropColumnQuery);
        await client.end();
        
        res.json({ success: true, message: '字段删除成功' });
      } else {
        res.status(400).json({ error: '暂不支持此数据库类型的字段删除' });
      }
    } catch (error: any) {
      console.error('删除表字段错误:', error);
      res.status(500).json({ 
        error: error.message || '删除表字段失败',
        details: error.toString()
      });
    }
  });

  // 备份表数据为SQL文件
  app.post('/api/connections/:id/backup', async (req: Request, res: Response) => {
    const connectionId = parseInt(req.params.id);
    const { tableName, database, format } = req.body;

    try {
      const connection = await storage.getConnection(connectionId);
      
      if (!connection) {
        return res.status(404).json({ error: '连接未找到' });
      }

      let client;
      let sqlContent = '';
      
      if (connection.type === 'postgresql') {
        client = createPostgreSQLClient({
          ...connection,
          database: database || connection.database
        });
        
        await client.connect();

        // 1. 获取表结构
        const structureQuery = `
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns 
          WHERE table_name = $1 AND table_schema = 'public'
          ORDER BY ordinal_position
        `;
        
        const structureResult = await client.query(structureQuery, [tableName]);
        
        // 生成CREATE TABLE语句
        sqlContent += `-- 备份文件: ${tableName}\n`;
        sqlContent += `-- 生成时间: ${new Date().toISOString()}\n`;
        sqlContent += `-- 数据库: ${database}\n\n`;
        
        sqlContent += `DROP TABLE IF EXISTS ${tableName};\n\n`;
        sqlContent += `CREATE TABLE ${tableName} (\n`;
        
        const columnDefinitions = structureResult.rows.map((col: any) => {
          let definition = `    ${col.column_name} ${col.data_type}`;
          
          if (col.character_maximum_length) {
            definition += `(${col.character_maximum_length})`;
          } else if (col.numeric_precision && col.numeric_scale !== null) {
            definition += `(${col.numeric_precision},${col.numeric_scale})`;
          } else if (col.numeric_precision) {
            definition += `(${col.numeric_precision})`;
          }
          
          if (col.is_nullable === 'NO') {
            definition += ' NOT NULL';
          }
          
          if (col.column_default) {
            definition += ` DEFAULT ${col.column_default}`;
          }
          
          return definition;
        });
        
        sqlContent += columnDefinitions.join(',\n');
        sqlContent += '\n);\n\n';

        // 2. 获取表数据
        const dataQuery = `SELECT * FROM ${tableName}`;
        const dataResult = await client.query(dataQuery);
        
        if (dataResult.rows.length > 0) {
          sqlContent += `-- 插入数据\n`;
          
          for (const row of dataResult.rows) {
            const columns = Object.keys(row);
            const values = columns.map(col => {
              const value = row[col];
              if (value === null) return 'NULL';
              if (typeof value === 'string') {
                return `'${value.replace(/'/g, "''")}'`;
              }
              if (value instanceof Date) {
                return `'${value.toISOString()}'`;
              }
              return value;
            });
            
            sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
          }
        } else {
          sqlContent += `-- 表中无数据\n`;
        }

        await client.end();
        
      } else {
        return res.status(400).json({ error: '暂不支持此数据库类型的备份' });
      }

      // 生成文件名：表名_年-月-日-时分秒.sql
      const now = new Date();
      const timestamp = now.getFullYear() + '-' + 
                       String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(now.getDate()).padStart(2, '0') + '-' + 
                       String(now.getHours()).padStart(2, '0') + 
                       String(now.getMinutes()).padStart(2, '0') + 
                       String(now.getSeconds()).padStart(2, '0');
      
      const filename = `${tableName}_${timestamp}.sql`;

      // 设置响应头
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(sqlContent);
      
    } catch (error: any) {
      console.error('备份表数据错误:', error);
      res.status(500).json({ 
        error: error.message || '备份表数据失败',
        details: error.toString()
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
