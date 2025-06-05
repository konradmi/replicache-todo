"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import { useReplicache, useTodoMutations } from "@/lib/replicache-provider";

export default function TodoApp() {
  const [inputValue, setInputValue] = useState("");
  const { todos, loading } = useReplicache();
  const { createTodo, deleteTodo, toggleTodo } = useTodoMutations();

  const handleAddTodo = async () => {
    if (inputValue.trim()) {
      await createTodo(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddTodo();
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto mt-8 p-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-4">
      <Card>
        <CardHeader>
          <CardTitle>TODO App</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Add a new todo..." 
              className="flex-1"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <Button onClick={handleAddTodo}>Add</Button>
          </div>

          <div className="space-y-2">
            {todos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-2 p-2 border rounded">
                <Checkbox 
                  checked={todo.completed}
                  onCheckedChange={(checked) => toggleTodo(todo.id, !!checked)}
                />
                <span className={`flex-1 ${todo.completed ? 'line-through text-gray-500' : ''}`}>
                  {todo.text}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => deleteTodo(todo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {todos.length === 0 && (
              <div className="text-center text-gray-500 py-4">
                No todos yet. Add one above!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
