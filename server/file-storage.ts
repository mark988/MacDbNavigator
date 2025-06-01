import fs from 'fs/promises';
import path from 'path';
import { 
  type Connection, 
  type InsertConnection,
  type QueryHistory,
  type InsertQueryHistory
} from "@shared/schema";
import { IStorage } from "./storage";

interface FileData {
  connections: Connection[];
  queryHistories: QueryHistory[];
  nextConnectionId: number;
  nextHistoryId: number;
}

export class FileStorage implements IStorage {
  private dataFile: string;
  private data: FileData;

  constructor(dataFile: string = './database-connections.json') {
    this.dataFile = dataFile;
    this.data = {
      connections: [],
      queryHistories: [],
      nextConnectionId: 1,
      nextHistoryId: 1
    };
  }

  private async loadData(): Promise<void> {
    try {
      const fileContent = await fs.readFile(this.dataFile, 'utf-8');
      this.data = JSON.parse(fileContent);
    } catch (error) {
      // File doesn't exist or is invalid, use default data
      await this.saveData();
    }
  }

  private async saveData(): Promise<void> {
    try {
      await fs.writeFile(this.dataFile, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save data to file:', error);
      throw new Error('Failed to save connection data');
    }
  }

  async getConnections(): Promise<Connection[]> {
    await this.loadData();
    return this.data.connections;
  }

  async getConnection(id: number): Promise<Connection | undefined> {
    await this.loadData();
    return this.data.connections.find(conn => conn.id === id);
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    await this.loadData();
    
    const connection: Connection = {
      id: this.data.nextConnectionId++,
      ...insertConnection,
      database: insertConnection.database || null,
      useSSL: insertConnection.useSSL || false,
      isConnected: false,
      createdAt: new Date()
    };
    
    this.data.connections.push(connection);
    await this.saveData();
    
    return connection;
  }

  async updateConnection(id: number, updates: Partial<InsertConnection>): Promise<Connection | undefined> {
    await this.loadData();
    
    const connectionIndex = this.data.connections.findIndex(conn => conn.id === id);
    if (connectionIndex === -1) {
      return undefined;
    }
    
    const updated: Connection = { 
      ...this.data.connections[connectionIndex], 
      ...updates 
    };
    
    this.data.connections[connectionIndex] = updated;
    await this.saveData();
    
    return updated;
  }

  async deleteConnection(id: number): Promise<boolean> {
    await this.loadData();
    
    const initialLength = this.data.connections.length;
    this.data.connections = this.data.connections.filter(conn => conn.id !== id);
    
    if (this.data.connections.length !== initialLength) {
      await this.saveData();
      return true;
    }
    
    return false;
  }

  async updateConnectionStatus(id: number, isConnected: boolean): Promise<void> {
    await this.loadData();
    
    const connection = this.data.connections.find(conn => conn.id === id);
    if (connection) {
      connection.isConnected = isConnected;
      await this.saveData();
    }
  }

  async getQueryHistory(connectionId?: number): Promise<QueryHistory[]> {
    await this.loadData();
    
    if (connectionId) {
      return this.data.queryHistories.filter(history => history.connectionId === connectionId);
    }
    
    return this.data.queryHistories;
  }

  async addQueryHistory(insertHistory: InsertQueryHistory): Promise<QueryHistory> {
    await this.loadData();
    
    const history: QueryHistory = {
      id: this.data.nextHistoryId++,
      ...insertHistory,
      connectionId: insertHistory.connectionId || null,
      executionTime: insertHistory.executionTime || null,
      rowCount: insertHistory.rowCount || null,
      createdAt: new Date()
    };
    
    this.data.queryHistories.push(history);
    await this.saveData();
    
    return history;
  }

  async deleteQueryHistory(id: number): Promise<boolean> {
    await this.loadData();
    
    const initialLength = this.data.queryHistories.length;
    this.data.queryHistories = this.data.queryHistories.filter(history => history.id !== id);
    
    if (this.data.queryHistories.length !== initialLength) {
      await this.saveData();
      return true;
    }
    
    return false;
  }
}