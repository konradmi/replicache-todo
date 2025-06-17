"use client";

import TodoApp from '@/todo-app'
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function Page() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className='max-w-md mx-auto mt-8 p-4 text-center'>Loading...</div>;
  }

  if (status === 'unauthenticated') {
    return (
      <div className='max-w-md mx-auto mt-8 p-4 text-center'>
        <Button onClick={() => signIn('google')}>Sign in with Google</Button>
      </div>
    );
  }

  return (
    <div>
      <div className='flex justify-end max-w-md mx-auto mt-4'>
        <Button variant='outline' size='sm' onClick={() => signOut()}>Sign out</Button>
      </div>
      <TodoApp />
    </div>
  );
}
