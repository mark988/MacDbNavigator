import mysql from "mysql2/promise";
import { Client } from "pg";
import type { Connection } from "../shared/schema";

export function createMySQLConnection(connection: Connection) {
  return mysql.createConnection({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: connection.database || undefined,
    connectTimeout: 5000,
  });
}

export function createPostgreSQLClient(connection: Connection) {
  return new Client({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    database: connection.database || 'postgres',
    connectionTimeoutMillis: 5000,
    ssl: connection.useSSL ? { rejectUnauthorized: false } : false,
  });
}