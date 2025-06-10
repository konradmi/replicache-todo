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
        deleted_at INTEGER
      )
    `);

  
    db.exec(`
      CREATE TABLE IF NOT EXISTS client_mutations (
        client_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        last_mutation_id INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);


    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_client_mutations_user_id ON client_mutations(user_id)
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
}

export function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    text: row.text,
    completed: Boolean(row.completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
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
    const stmt = this.db.prepare(`
      INSERT INTO todos (id, user_id, text, completed, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const row = todoToRow(todo, userId);
    stmt.run(
      row.id,
      row.user_id,
      row.text,
      row.completed,
      row.created_at,
      row.updated_at,
      row.deleted_at
    );
  }

  updateTodoForUser(id: string, userId: string, updates: Partial<Todo>): boolean {
    const existing = this.getTodoByIdForUser(id, userId);
    if (!existing) return false;

    const updatedTodo: Todo = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const stmt = this.db.prepare(`
      UPDATE todos 
      SET text = ?, completed = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `);
    
    const result = stmt.run(
      updatedTodo.text,
      updatedTodo.completed ? 1 : 0,
      updatedTodo.updatedAt,
      id,
      userId
    );

    return result.changes > 0;
  }

  deleteTodoForUser(id: string, userId: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE todos 
      SET deleted_at = ?
      WHERE id = ? AND user_id = ? AND deleted_at IS NULL
    `);
    
    const result = stmt.run(Date.now(), id, userId);
    return result.changes > 0;
  }

  hardDeleteTodoForUser(id: string, userId: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM todos WHERE id = ? AND user_id = ?`);
    const result = stmt.run(id, userId);
    return result.changes > 0;
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  // Client mutation tracking methods with user context
  getClientInfo(clientID: string): { userId: string; lastMutationID: number } | null {
    const stmt = this.db.prepare(`
      SELECT user_id, last_mutation_id 
      FROM client_mutations 
      WHERE client_id = ?
    `);
    const result = stmt.get(clientID) as { user_id: string; last_mutation_id: number } | undefined;
    return result ? { userId: result.user_id, lastMutationID: result.last_mutation_id } : null;
  }

  getLastMutationID(clientID: string): number {
    const clientInfo = this.getClientInfo(clientID);
    return clientInfo?.lastMutationID || 0;
  }

  updateLastMutationID(clientID: string, userId: string, mutationID: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO client_mutations (client_id, user_id, last_mutation_id, updated_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(clientID, userId, mutationID, Date.now());
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
