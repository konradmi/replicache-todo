import Database from 'better-sqlite3';
import type { Todo } from '@/types';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database('todos.db');
    
    // Create todos table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        text TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        deleted_at INTEGER
      )
    `);

    // Create client_mutations table for tracking processed mutations
    db.exec(`
      CREATE TABLE IF NOT EXISTS client_mutations (
        client_id TEXT PRIMARY KEY,
        last_mutation_id INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Create an index on created_at for faster sorting
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at)
    `);
  }
  
  return db;
}

export interface TodoRow {
  id: string;
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

export function todoToRow(todo: Todo): TodoRow {
  return {
    id: todo.id,
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

  getAllTodos(): Todo[] {
    const stmt = this.db.prepare(`
      SELECT * FROM todos 
      WHERE deleted_at IS NULL 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all() as TodoRow[];
    return rows.map(rowToTodo);
  }

  getTodoById(id: string): Todo | null {
    const stmt = this.db.prepare(`
      SELECT * FROM todos 
      WHERE id = ? AND deleted_at IS NULL
    `);
    const row = stmt.get(id) as TodoRow | undefined;
    return row ? rowToTodo(row) : null;
  }

  createTodo(todo: Todo): void {
    const stmt = this.db.prepare(`
      INSERT INTO todos (id, text, completed, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const row = todoToRow(todo);
    stmt.run(
      row.id,
      row.text,
      row.completed,
      row.created_at,
      row.updated_at,
      row.deleted_at
    );
  }

  updateTodo(id: string, updates: Partial<Todo>): boolean {
    const existing = this.getTodoById(id);
    if (!existing) return false;

    const updatedTodo: Todo = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };

    const stmt = this.db.prepare(`
      UPDATE todos 
      SET text = ?, completed = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    const result = stmt.run(
      updatedTodo.text,
      updatedTodo.completed ? 1 : 0,
      updatedTodo.updatedAt,
      id
    );

    return result.changes > 0;
  }

  deleteTodo(id: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE todos 
      SET deleted_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `);
    
    const result = stmt.run(Date.now(), id);
    return result.changes > 0;
  }

  hardDeleteTodo(id: string): boolean {
    const stmt = this.db.prepare(`DELETE FROM todos WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  getLastMutationID(clientID: string): number {
    const stmt = this.db.prepare(`
      SELECT last_mutation_id FROM client_mutations 
      WHERE client_id = ?
    `);
    const result = stmt.get(clientID) as { last_mutation_id: number } | undefined;
    return result?.last_mutation_id || 0;
  }

  updateLastMutationID(clientID: string, mutationID: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO client_mutations (client_id, last_mutation_id, updated_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(clientID, mutationID, Date.now());
  }

  getAllLastMutationIDs(): Record<string, number> {
    const stmt = this.db.prepare(`
      SELECT client_id, last_mutation_id FROM client_mutations
    `);
    const results = stmt.all() as Array<{ client_id: string; last_mutation_id: number }>;
    
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
