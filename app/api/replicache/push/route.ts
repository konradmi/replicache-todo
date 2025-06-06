import { NextRequest, NextResponse } from 'next/server';
import { getTodoDatabase } from '@/lib/database';
import type { Todo } from '@/types';

type CreateTodoArgs = {
  text: string;
  completed: boolean;
}

type Mutation = {
  id: number;
  clientID: string;
  name: string;
  args: CreateTodoArgs;
  timestamp: number;
}

type PushRequest = {
  clientGroupID: string;
  mutations: Mutation[];
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json();

    const db = getTodoDatabase();
    const processedMutations: Record<string, number> = {};

    for (const mutation of body.mutations) {
      try {
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
            };

            db.createTodo(newTodo);
            break;
          }
          default:
            console.log('Unknown mutation:', mutation.name);
            // Don't process unknown mutations, but don't fail either
            continue;
        }

        // Update the last mutation ID for this client
        db.updateLastMutationID(mutation.clientID, mutation.id);
        
        // Track successfully processed mutation
        processedMutations[mutation.clientID] = mutation.id;
        
        console.log(`Successfully processed mutation ${mutation.id} from client ${mutation.clientID}`);
      } catch (mutationError) {
        console.error('Error processing mutation:', mutation, mutationError);
        // Continue processing other mutations even if one fails
      }
    }

    const response = {
      lastMutationIDChanges: processedMutations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
