"use client";

import { TasksPageContent } from "@/components/tasks-page-content";

export default function TasksPage() {
  return (
    <section className="space-y-8">
      <TasksPageContent initialView="list" />
    </section>
  );
}
