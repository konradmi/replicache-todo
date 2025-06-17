import { NextRequest, NextResponse } from 'next/server';
import { getTodoDatabase } from '@/lib/database';
import type { Todo } from '@/types';
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

type CreateTodoArgs = {
  text: string;
  completed: boolean;
};

type UpdateTodoArgs = {
  id: string;
  updates: Partial<{
    text: string;
    completed: boolean;
  }>;
};

type DeleteTodoArgs = string

type Mutation =
  | {
      id: number;
      clientID: string;
      name: 'createTodo';
      args: CreateTodoArgs;
      timestamp: number;
    }
  | {
      id: number;
      clientID: string;
      name: 'updateTodo';
      args: UpdateTodoArgs;
      timestamp: number;
    }
  | {
      id: number;
      clientID: string;
      name: 'deleteTodo';
      args: DeleteTodoArgs;
      timestamp: number;
    };

type PushRequest = {
  clientGroupID: string;
  mutations: Mutation[];
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userEmail = session.user.email;

  try {
    const body: PushRequest = await request.json();

    const db = getTodoDatabase();
    const processedMutations: Record<string, number> = {};

    for (const mutation of body.mutations as Mutation[]) {
      try {
        // Why Math.max?
        // If mutations are received out of order or duplicated, using just mutation.id
        // could cause the processed mutation counter to go backwards.
        if (db.hasMutationBeenProcessed(mutation.clientID, mutation.id)) {
          processedMutations[mutation.clientID] = Math.max(
            processedMutations[mutation.clientID] || 0,
            mutation.id
          );
          continue;
        }

        const expectedNextID = db.getLastMutationID(mutation.clientID) + 1;
        if (mutation.id !== expectedNextID) {
          console.error(`Mutation out of order. Expected ${expectedNextID}, got ${mutation.id} from client ${mutation.clientID}`);
          // Skip this mutation - client needs to resync
          continue;
        }

        switch (mutation.name) {
          case 'createTodo': {
            const { text, completed } = mutation.args;
            const newTodo: Todo = {
              id: crypto.randomUUID(),
              text,
              completed,
              createdAt: Date.now(),
              updatedAt: null,
              deletedAt: null,
              version: 0,
            };
            db.createTodoForUser(newTodo, userEmail);
            break;
          }
          case 'updateTodo': {
            const { id, updates } = mutation.args;
            db.updateTodoForUser(id, userEmail, updates);
            break;
          }
          case 'deleteTodo': {
            const id = mutation.args;
            db.deleteTodoForUser(id, userEmail);
            break;
          }
          default: {
            throw new Error(`Unknown mutation: ${String((mutation as { name: string }).name)}`);
          }
        }

        db.updateLastMutationID(mutation.clientID, userEmail, mutation.id);
        
        processedMutations[mutation.clientID] = mutation.id;        
      } catch (mutationError) {
        console.error('Error processing mutation:', mutation, mutationError);
      }
    }

    const response = {};

    return NextResponse.json(response);
  } catch (error) {
    console.error('Push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
