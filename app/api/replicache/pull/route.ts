import { NextRequest, NextResponse } from 'next/server';
import { getTodoDatabase } from '@/lib/database';
import type { PullCookie } from '@/types';

const userEmail = 'test@test.com';

// Row-versioning strategy implementation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const db = getTodoDatabase();

    const requestCookie: PullCookie | null = body.cookie;
    const isFirstPull = !requestCookie;

    // Get current max versions
    const currentTodoVersion = db.getMaxVersionForUser(userEmail);
    const currentClientMutationVersion = db.getMaxClientMutationVersionForUser(userEmail);
    
    // Calculate the new order (max of both todo and client mutation versions)
    const newOrder = Math.max(currentTodoVersion, currentClientMutationVersion);

    const patch = [];
    let lastMutationIDChanges: Record<string, number> = {};

    if (isFirstPull) {
      // First pull: clear and send all todos
      patch.push({ op: 'clear' });
      
      const allTodos = db.getAllTodosWithVersionForUser(userEmail);
      allTodos.forEach(todo => {
        patch.push({
          op: 'put',
          key: `todo/${todo.id}`,
          value: todo,
        });
      });

      lastMutationIDChanges = db.getAllLastMutationIDsForUser(userEmail);
    } else {
      // Delta pull: only send changes since last cookie
      const sinceVersion = requestCookie.order;
      
      const changedTodos = db.getTodosChangedSinceVersion(userEmail, sinceVersion);
      changedTodos.forEach(todo => {
        if (todo.deletedAt) {
          patch.push({ op: 'del', key: `todo/${todo.id}` });
        } else {
          patch.push({
            op: 'put',
            key: `todo/${todo.id}`,
            value: todo,
          });
        }
      });

      lastMutationIDChanges = db.getClientMutationsChangedSinceVersion(userEmail, sinceVersion);
    }

    const newCookie: PullCookie = {
      order: newOrder,
      lastMutationID: 0, // This field is not used in our per-user implementation but kept for compatibility
    };
  
    const response = {
      cookie: newCookie,
      lastMutationIDChanges,
      patch,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Pull error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
