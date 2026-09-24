import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { IconTrash } from "@tabler/icons-react"
import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { api } from "@workspace/backend/api"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"
import { type FormEvent, useState } from "react"
import { errorMessage } from "@/lib/errors"

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: Dashboard,
})

// Example page for the `tasks` feature. `useSuspenseQuery(convexQuery(...))`
// subscribes to the query: changes from any tab or device show up instantly.
function Dashboard() {
  const { data: tasks } = useSuspenseQuery(convexQuery(api.tasks.list, {}))
  const onError = (error: Error) => toast.error(errorMessage(error))

  const create = useMutation({
    mutationFn: useConvexMutation(api.tasks.create),
    onError,
  })
  const toggle = useMutation({
    mutationFn: useConvexMutation(api.tasks.toggle),
    onError,
  })
  const remove = useMutation({
    mutationFn: useConvexMutation(api.tasks.remove),
    onError,
  })

  const [text, setText] = useState("")

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // Clear right away so the next task can be typed while this one saves.
    // The live query shows the new task as soon as it's stored.
    setText("")
    create.mutate({ text }, { onError: () => setText(text) })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardDescription>
          Open this page in two tabs and watch them stay in sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What needs doing?"
            aria-label="New task"
          />
          <Button type="submit" disabled={!text.trim()}>
            Add
          </Button>
        </form>

        {tasks.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground text-sm">
            No tasks yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {tasks.map((task) => (
              <li key={task._id} className="flex items-center gap-3 py-2">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => toggle.mutate({ id: task._id })}
                  aria-label={`Mark "${task.text}" as done`}
                />
                <span
                  className={
                    task.completed
                      ? "flex-1 text-muted-foreground line-through"
                      : "flex-1"
                  }
                >
                  {task.text}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove.mutate({ id: task._id })}
                  aria-label={`Delete "${task.text}"`}
                >
                  <IconTrash />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
