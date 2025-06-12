# Replicache Todo App

## Row-Versioning Strategy

This app implements Replicache's [Row-Versioning Strategy](https://doc.replicache.dev/strategies/row-version) with the following key features:

### Version Management

Every record (todos and client mutations) has a `version` field that increments with each change:

```typescript
type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number | null;
  deletedAt: number | null;
  version: number; // Increments on every change
}
```

### Cookie Structure

The pull endpoint uses a structured cookie to track client state:

```typescript
type PullCookie = {
  order: number;        // Highest version seen by client
  lastMutationID: number; // For compatibility (not used in per-user setup)
}
```

### Delta Synchronization

#### First Pull (No Cookie)
```typescript
// Client sends: { cookie: null }
// Server responds with:
{
  cookie: { order: 5, lastMutationID: 0 },
  patch: [
    { op: 'clear' },
    { op: 'put', key: 'todo/1', value: { ...todo, version: 1 } },
    { op: 'put', key: 'todo/2', value: { ...todo, version: 3 } },
    { op: 'put', key: 'todo/3', value: { ...todo, version: 5 } }
  ],
  lastMutationIDChanges: { 'client-1': 10, 'client-2': 5 }
}
```

#### Subsequent Pulls (Delta Sync)
```typescript
// Client sends: { cookie: { order: 3, lastMutationID: 0 } }
// Server responds with only changes since version 3:
{
  cookie: { order: 7, lastMutationID: 0 },
  patch: [
    { op: 'put', key: 'todo/4', value: { ...todo, version: 6 } }, // New todo
    { op: 'del', key: 'todo/2' } // Deleted todo (version 7)
  ],
  lastMutationIDChanges: { 'client-3': 8 } // Only changed clients
}
```

### Version Assignment Logic

#### For Todos
```typescript
createTodoForUser(todo: Todo, userId: string): void {
  const currentMaxVersion = this.getMaxVersionForUser(userId);
  const newVersion = currentMaxVersion + 1; // Always incremental
  
  // Insert with calculated version
  stmt.run(/* ... */, newVersion);
}
```

#### For Client Mutations
```typescript
updateLastMutationID(clientID: string, userId: string, mutationID: number): void {
  const currentMaxVersion = this.getMaxClientMutationVersionForUser(userId);
  const newVersion = currentMaxVersion + 1; // Always incremental
  
  stmt.run(clientID, userId, mutationID, Date.now(), newVersion);
}
```

### Per-User Isolation

- All data is scoped by `user_id` (email address)
- Each user has their own version sequence: `1, 2, 3, 4...`
- Cookie `order` represents the max version across todos and client mutations for that user

## API Endpoints

### POST `/api/replicache/pull`
Implements delta sync using row-versioning:
- Parses incoming cookie to determine client state
- Returns only records with `version > cookie.order`
- Sends new cookie with updated `order`

### POST `/api/replicache/push`
Processes mutations and increments versions:
- Validates mutation order per client
- Creates todos with `version = maxVersion + 1`
- Updates client mutation tracking with versioning

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Set up environment:**
   ```bash
   # Add to .env.local
   NEXT_PUBLIC_REPLICACHE_LICENSE_KEY=your_license_key
   ```

4. **Run development server:**
   ```bash
   pnpm dev
   ```

5. **Open multiple tabs** at [http://localhost:3000](http://localhost:3000) to see real-time sync in action!

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client A      │    │   Next.js API    │    │   SQLite DB     │
│   (Replicache)  │◄──►│   /pull /push    │◄──►│   (Versioned)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client B      │    │  Row-Versioning  │    │  Version: 1,2,3 │
│   (Replicache)  │    │    Strategy      │    │  Per User       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```
