import { TasksPageContent } from "../page";

export default function MyTasksPage() {
  return (
    <section className="space-y-8">
      <TasksPageContent initialView="my" />
    </section>
  );
}
