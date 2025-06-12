"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Replicache, type WriteTransaction } from 'replicache';
import { Todo } from '@/types';

// Define mutators
const mutators = {
  createTodo: async (tx: WriteTransaction, todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'version'>) => {
    const id = crypto.randomUUID();
    const newTodo: Omit<Todo, 'version'> = { // Version will be set properly by the server
      id,
      text: todo.text,
      completed: todo.completed,
      createdAt: Date.now(),
      deletedAt: null,
      updatedAt: null,
    };
    await tx.set(`todo/${id}`, newTodo);
  },
  updateTodo: async (tx: WriteTransaction, { id, updates }: { id: string; updates: Partial<Omit<Todo, 'id'>> }) => {
    const existing = await tx.get<Todo>(`todo/${id}`);
    if (existing) {
      const updatedTodo = { 
        ...existing, 
        ...updates, 
        updatedAt: Date.now(),
      };
      await tx.set(`todo/${id}`, updatedTodo);
    }
  },
  deleteTodo: async (tx: WriteTransaction, id: string) => {
    await tx.del(`todo/${id}`);
  },
};

type ReplicacheInstance = Replicache<typeof mutators>;

type ReplicacheContextType = {
  rep: ReplicacheInstance | null;
  todos: Todo[];
  loading: boolean;
  userEmail: string | null;
}

const ReplicacheContext = createContext<ReplicacheContextType | null>(null);

const userEmail = 'test@test.com';

export function ReplicacheProvider({ children }: { children: React.ReactNode }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [rep, setRep] = useState<ReplicacheInstance | null>(null);

  useEffect(() => {
    const replicacheInstance = new Replicache({
      name: `todo-app-${userEmail}`,
      licenseKey: process.env.NEXT_PUBLIC_REPLICACHE_LICENSE_KEY || "",
      mutators,
      pullURL: '/api/replicache/pull',
      pushURL: '/api/replicache/push',
    }) as ReplicacheInstance;

    setRep(replicacheInstance);

    const unsubscribe = replicacheInstance.subscribe(
      async (tx) => {
        const todos: Todo[] = [];
        for await (const todo of tx.scan({ prefix: 'todo/' }).values()) {
          todos.push(todo as Todo);
        }
        return todos.sort((a, b) => b.createdAt - a.createdAt);
      },
      {
        onData: (data: Todo[]) => {
          setTodos(data);
          setLoading(false);
        },
      }
    );

    return () => {
      unsubscribe();
      replicacheInstance.close();
    };
  }, []);

  return (
    <ReplicacheContext.Provider value={{ rep, todos, loading, userEmail }}>
      {children}
    </ReplicacheContext.Provider>
  );
}

export function useReplicache() {
  const context = useContext(ReplicacheContext);
  if (!context) {
    throw new Error('useReplicache must be used within a ReplicacheProvider');
  }
  return context;
}

export function useTodoMutations() {
  const { rep } = useReplicache();

  const createTodo = async (text: string) => {
    if (!rep) return;
    await rep.mutate.createTodo({ text, completed: false });
  };

  const updateTodo = async (id: string, updates: Partial<Omit<Todo, 'id'>>) => {
    if (!rep) return;
    await rep.mutate.updateTodo({ id, updates });
  };

  const deleteTodo = async (id: string) => {
    if (!rep) return;
    await rep.mutate.deleteTodo(id);
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    if (!rep) return;
    await rep.mutate.updateTodo({ id, updates: { completed } });
  };

  return {
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
  };
} 
