import { NextRequest, NextResponse } from 'next/server';
import { getTodoDatabase } from '@/lib/database';

const userEmail = 'test@test.com';

// the Reset Strategy https://doc.replicache.dev/strategies/reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const db = getTodoDatabase();
    
    const todos = db.getAllTodosForUser(userEmail);
    const lastMutationIDChanges = db.getAllLastMutationIDsForUser(userEmail);

    // Handle the case where the client has no previous state (cookie is null)
    // In this case, we need to send all data with a clear operation first
    const requestCookie = body.cookie;
    const isFirstPull = !requestCookie;

    const patch = [];
    
    // If this is the first pull or we can't determine the client's state,
    // clear everything and send all todos
    if (isFirstPull) {
      patch.push({ op: 'clear' });
    }

    // Add all todos to the patch
    todos.forEach(todo => {
      patch.push({
        op: 'put',
        key: `todo/${todo.id}`,
        value: todo,
      });
    });

    const response = {
      cookie: Date.now(),
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
