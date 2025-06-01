import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'mysql' | 'postgresql'
  host: text("host").notNull(),
  port: integer("port").notNull(),
  database: text("database"),
  username: text("username").notNull(),
  password: text("password").notNull(),
  useSSL: boolean("use_ssl").default(false),
  isConnected: boolean("is_connected").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const queryHistory = pgTable("query_history", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => connections.id),
  query: text("query").notNull(),
  executionTime: integer("execution_time"), // in milliseconds
  rowCount: integer("row_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  isConnected: true,
  createdAt: true,
});

export const insertQueryHistorySchema = createInsertSchema(queryHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;
export type InsertQueryHistory = z.infer<typeof insertQueryHistorySchema>;
export type QueryHistory = typeof queryHistory.$inferSelect;

// Query result types
export type QueryResult = {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  executionTime: number;
  multiStatementResults?: Array<{
    statement: string;
    result: QueryResult;
    index: number;
  }>;
};

export type DatabaseObject = {
  name: string;
  type: 'table' | 'view' | 'procedure' | 'function';
  schema?: string;
};

export type DatabaseInfo = {
  databases: string[];
  tables: DatabaseObject[];
};

export type TableColumn = {
  name: string;
  type: string;
  nullable: boolean;
  default?: string | null;
  key?: string;
  extra?: string;
  maxLength?: number | null;
  precision?: number | null;
  scale?: number | null;
};

export type TableStructure = {
  tableName: string;
  columns: TableColumn[];
};
