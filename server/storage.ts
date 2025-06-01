import { 
  connections, 
  queryHistory, 
  type Connection, 
  type InsertConnection,
  type QueryHistory,
  type InsertQueryHistory
} from "@shared/schema";

export interface IStorage {
  // Connection methods
  getConnections(): Promise<Connection[]>;
  getConnection(id: number): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  updateConnection(id: number, connection: Partial<InsertConnection>): Promise<Connection | undefined>;
  deleteConnection(id: number): Promise<boolean>;
  updateConnectionStatus(id: number, isConnected: boolean): Promise<void>;

  // Query history methods
  getQueryHistory(connectionId?: number): Promise<QueryHistory[]>;
  addQueryHistory(history: InsertQueryHistory): Promise<QueryHistory>;
  deleteQueryHistory(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private connections: Map<number, Connection>;
  private queryHistories: Map<number, QueryHistory>;
  private currentConnectionId: number;
  private currentHistoryId: number;

  constructor() {
    this.connections = new Map();
    this.queryHistories = new Map();
    this.currentConnectionId = 1;
    this.currentHistoryId = 1;

    // Add some sample connections for demo
    this.createConnection({
      name: "Production MySQL",
      type: "mysql",
      host: "localhost",
      port: 3306,
      database: "ecommerce_db",
      username: "root",
      password: "password"
    });

    this.createConnection({
      name: "Staging PostgreSQL",
      type: "postgresql",
      host: "localhost",
      port: 5432,
      database: "staging_db",
      username: "postgres",
      password: "password"
    });
  }

  async getConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values());
  }

  async getConnection(id: number): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const id = this.currentConnectionId++;
    const connection: Connection = {
      id,
      name: insertConnection.name,
      type: insertConnection.type,
      host: insertConnection.host,
      port: insertConnection.port,
      database: insertConnection.database,
      username: insertConnection.username,
      password: insertConnection.password,
      useSSL: insertConnection.useSSL ?? false,
      isConnected: false,
      createdAt: new Date(),
    };
    this.connections.set(id, connection);
    return connection;
  }

  async updateConnection(id: number, updates: Partial<InsertConnection>): Promise<Connection | undefined> {
    const existing = this.connections.get(id);
    if (!existing) return undefined;

    const updated: Connection = { ...existing, ...updates };
    this.connections.set(id, updated);
    return updated;
  }

  async deleteConnection(id: number): Promise<boolean> {
    return this.connections.delete(id);
  }

  async updateConnectionStatus(id: number, isConnected: boolean): Promise<void> {
    const connection = this.connections.get(id);
    if (connection) {
      connection.isConnected = isConnected;
      this.connections.set(id, connection);
    }
  }

  async getQueryHistory(connectionId?: number): Promise<QueryHistory[]> {
    const histories = Array.from(this.queryHistories.values());
    if (connectionId) {
      return histories.filter(h => h.connectionId === connectionId);
    }
    return histories.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  async addQueryHistory(insertHistory: InsertQueryHistory): Promise<QueryHistory> {
    const id = this.currentHistoryId++;
    const history: QueryHistory = {
      id,
      query: insertHistory.query,
      connectionId: insertHistory.connectionId ?? null,
      executionTime: insertHistory.executionTime ?? null,
      rowCount: insertHistory.rowCount ?? null,
      createdAt: new Date(),
    };
    this.queryHistories.set(id, history);
    return history;
  }

  async deleteQueryHistory(id: number): Promise<boolean> {
    return this.queryHistories.delete(id);
  }
}

import { FileStorage } from "./file-storage";

export const storage = new FileStorage();
