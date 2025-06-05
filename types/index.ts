export type Todo = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  deletedAt: number | null;
  updatedAt: number | null;
}
