export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  deletedAt: number | null;
  updatedAt: number | null;
  version: number;
}

export type PullCookie = {
  order: number; // highest version seen by client
  lastMutationID: number; // last mutation ID processed for this user
}
