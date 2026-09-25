import { createFileRoute } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { AddTaskForm } from "@/components/tasks/AddTaskForm"
import { TaskList } from "@/components/tasks/TaskList"

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: DashboardPage,
})

// Example page for the `tasks` feature. Delete it with components/tasks and
// the backend's convex/tasks.ts when you start building.
function DashboardPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardDescription>
          Open this page in two tabs and watch them stay in sync.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AddTaskForm />
        <TaskList />
      </CardContent>
    </Card>
  )
}
