import { TasksPageContent } from "@/components/tasks-page-content";

export default function MyTasksPage() {
  return (
    <section className="space-y-8">
      <TasksPageContent initialView="my" />
    </section>
  );
}
