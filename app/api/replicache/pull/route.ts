import { NextRequest, NextResponse } from 'next/server';
import { getTodoDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Pull request:', body);

    const db = getTodoDatabase();
    
    const todos = db.getAllTodos();

    const lastMutationIDChanges = db.getAllLastMutationIDs();

    const patch = todos.map(todo => ({
      op: 'put',
      key: `todo/${todo.id}`,
      value: todo,
    }));

    const response = {
      lastMutationIDChanges,
      patch,
    };

    console.log('Pull response:', {
      ...response,
      patch: `${patch.length} todos`
    });
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Pull error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
