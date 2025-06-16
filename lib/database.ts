import Database from 'better-sqlite3';
import type { Todo } from '@/types';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database('todos.db');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        text TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        deleted_at INTEGER,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);

  
    db.exec(`
      CREATE TABLE IF NOT EXISTS client_mutations (
        client_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        last_mutation_id INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);


    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_version ON todos(version)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_client_mutations_user_id ON client_mutations(user_id)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_client_mutations_version ON client_mutations(version)
    `);
  }
  
  return db;
}

export interface TodoRow {
  id: string;
  user_id: string;
  text: string;
  completed: number;
  created_at: number;
  updated_at: number | null;
  deleted_at: number | null;
  version: number;
}

export function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    version: row.version,
  };
}

export function todoToRow(todo: Todo, userId: string): TodoRow {
  return {
    id: todo.id,
    user_id: userId,
    text: todo.text,
    completed: todo.completed ? 1 : 0,
    created_at: todo.createdAt,
    updated_at: todo.updatedAt,
    deleted_at: todo.deletedAt,
    version: todo.version,
  };
}

export class TodoDatabase {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  getAllTodosForUser(userId: string): Todo[] {
    const stmt = this.db.prepare(`
      SELECT * FROM todos 
      WHERE user_id = ? AND deleted_at IS NULL 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId) as TodoRow[];
    return rows.map(rowToTodo);
  }

  getTodoByIdForUser(id: string, userId: string): Todo | null {
    const stmt = this.db.prepare(`
      SELECT * FROM todos 
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `);
    const row = stmt.get(id, userId) as TodoRow | undefined;
    return row ? rowToTodo(row) : null;
  }

  createTodoForUser(todo: Todo, userId: string): void {
    // Get the current max version and increment it for the new todo
    const currentMaxVersion = this.getMaxVersionForUser(userId);
    const newVersion = currentMaxVersion + 1;

    const stmt = this.db.prepare(`
      INSERT INTO todos (id, user_id, text, completed, created_at, updated_at, deleted_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      todo.id,
      userId,
      todo.text,
      todo.completed ? 1 : 0,
      todo.createdAt,
      todo.updatedAt,
      todo.deletedAt,
      newVersion
    );
  }

  updateTodoForUser(id: string, userId: string, updates: Partial<Todo>): boolean {
    const existing = this.getTodoByIdForUser(id, userId);
    if (!existing) return false;

    // Use current max version for the user, not just existing.version + 1
    const currentMaxVersion = this.getMaxVersionForUser(userId);
    const newVersion = currentMaxVersion + 1;

    const updatedTodo: Todo = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
      version: newVersion,
    };

    const stmt = this.db.prepare(`
      UPDATE todos 
      SET text = ?, completed = ?, updated_at = ?, version = ?
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `);
    
    const result = stmt.run(
      updatedTodo.text,
      updatedTodo.completed ? 1 : 0,
      updatedTodo.updatedAt,
      updatedTodo.version,
      id,
      userId
    );

    return result.changes > 0;
  }

  deleteTodoForUser(id: string, userId: string): boolean {
    const existing = this.getTodoByIdForUser(id, userId);
    if (!existing) return false;
    // Use current max version for the user, not just existing.version + 1
    const currentMaxVersion = this.getMaxVersionForUser(userId);
    const newVersion = currentMaxVersion + 1;

    const stmt = this.db.prepare(`
      UPDATE todos 
      SET deleted_at = ?, version = ?
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `);
    
    const result = stmt.run(Date.now(), newVersion, id, userId);
    return result.changes > 0;
  }

  getMaxVersionForUser(userId: string): number {
    const stmt = this.db.prepare(`
      SELECT MAX(version) as max_version FROM todos WHERE user_id = ?
    `);
    const result = stmt.get(userId) as { max_version: number | null } | undefined;
    return result?.max_version || 0;
  }

  getTodosChangedSinceVersion(userId: string, sinceVersion: number): Todo[] {
    const stmt = this.db.prepare(`
      SELECT * FROM todos 
      WHERE user_id = ? AND version > ?
      ORDER BY version ASC
    `);
    const rows = stmt.all(userId, sinceVersion) as TodoRow[];
    return rows.map(rowToTodo);
  }

  getAllTodosWithVersionForUser(userId: string): Todo[] {
    const stmt = this.db.prepare(`
      SELECT * FROM todos 
      WHERE user_id = ? AND deleted_at IS NULL 
      ORDER BY version ASC
    `);
    const rows = stmt.all(userId) as TodoRow[];
    return rows.map(rowToTodo);
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  getClientInfo(clientID: string): { userId: string; lastMutationID: number; version: number } | null {
    const stmt = this.db.prepare(`
      SELECT user_id, last_mutation_id, version
      FROM client_mutations 
      WHERE client_id = ?
    `);
    const result = stmt.get(clientID) as { user_id: string; last_mutation_id: number; version: number } | undefined;
    return result ? { userId: result.user_id, lastMutationID: result.last_mutation_id, version: result.version } : null;
  }

  getLastMutationID(clientID: string): number {
    const clientInfo = this.getClientInfo(clientID);
    return clientInfo?.lastMutationID || 0;
  }

  updateLastMutationID(clientID: string, userId: string, mutationID: number): void {
    // Get current max version for client mutations for this user
    const currentMaxVersion = this.getMaxClientMutationVersionForUser(userId);
    const newVersion = currentMaxVersion + 1;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO client_mutations (client_id, user_id, last_mutation_id, updated_at, version)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(clientID, userId, mutationID, Date.now(), newVersion);
  }

  getAllLastMutationIDsForUser(userId: string): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT client_id, last_mutation_id 
      FROM client_mutations
      WHERE user_id = ?
    `);
    const results = stmt.all(userId) as Array<{ client_id: string; last_mutation_id: number }>;
    
    const lastMutationIDChanges: Record<string, number> = {};
    for (const result of results) {
      lastMutationIDChanges[result.client_id] = result.last_mutation_id;
    }
    return lastMutationIDChanges;
  }

  getClientMutationsChangedSinceVersion(userId: string, sinceVersion: number): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT client_id, last_mutation_id 
      FROM client_mutations
      WHERE user_id = ? AND version > ?
    `);
    const results = stmt.all(userId, sinceVersion) as Array<{ client_id: string; last_mutation_id: number }>;
    
    const lastMutationIDChanges: Record<string, number> = {};
    for (const result of results) {
      lastMutationIDChanges[result.client_id] = result.last_mutation_id;
    }
    return lastMutationIDChanges;
  }

  getMaxClientMutationVersionForUser(userId: string): number {
    const stmt = this.db.prepare(`
      SELECT MAX(version) as max_version FROM client_mutations WHERE user_id = ?
    `);
    const result = stmt.get(userId) as { max_version: number | null } | undefined;
    return result?.max_version || 0;
  }

  hasMutationBeenProcessed(clientID: string, mutationID: number): boolean {
    const lastProcessedID = this.getLastMutationID(clientID);
    return mutationID <= lastProcessedID;
  }
}

let todoDb: TodoDatabase | null = null;

export function getTodoDatabase(): TodoDatabase {
  if (!todoDb) {
    todoDb = new TodoDatabase();
  }
  return todoDb;
} 
