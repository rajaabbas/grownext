"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SerializedTask } from "./api/tasks/serializer";

type TaskRecord = SerializedTask;

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === "COMPLETED").length,
    [tasks]
  );

  const formatOwner = (owner: TaskRecord["owner"]) => owner.fullName ?? owner.email ?? owner.id;

  const loadTasks = async () => {
    setInitializing(true);
    setError(null);
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to load tasks");
      }
      const json = await response.json();
      setTasks(json.tasks ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setInitializing(false);
    }
  };

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: trimmed, description: description.trim() || undefined })
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create task");
      }

      const json = await response.json();
      setTasks((prev) => [json.task, ...prev]);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (task: TaskRecord) => {
    setError(null);
    try {
      const nextStatus = task.status === "COMPLETED" ? "OPEN" : "COMPLETED";
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: nextStatus })
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to update task");
      }

      const json = await response.json();
      setTasks((prev) => prev.map((item) => (item.id === task.id ? json.task : item)));
    } catch (err) {
      setError((err as Error).message);
      await loadTasks();
    }
  };

  const removeTask = async (taskId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 204) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to delete task");
      }
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err) {
      setError((err as Error).message);
      await loadTasks();
    }
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Tasks</h1>
        <p className="text-slate-400">
          Track and complete work items for the active tenant. All operations are authorized with identity tokens.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-4 md:flex-row">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Add a task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Optional description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <button
            className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
            disabled={loading || !title.trim()}
            type="submit"
          >
            {loading ? "Saving..." : "Add task"}
          </button>
        </form>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
          <span>Total: {tasks.length}</span>
          <span>Completed: {completedCount}</span>
        </div>

        <ul className="mt-6 space-y-3">
          {initializing && <li className="text-sm text-slate-500">Loading tasks…</li>}
          {!initializing && tasks.length === 0 && (
            <li className="text-sm text-slate-500">No tasks yet. Create your first task above.</li>
          )}
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:flex-row md:items-center md:justify-between"
            >
              <label className="flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={task.status === "COMPLETED"}
                  onChange={() => void toggleStatus(task)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                />
                <div>
                  <div className={task.status === "COMPLETED" ? "line-through text-slate-500" : ""}>{task.title}</div>
                  {task.description && <div className="text-xs text-slate-500">{task.description}</div>}
                  <div className="text-xs text-slate-500">Owner: {formatOwner(task.owner)}</div>
                </div>
              </label>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Status: {task.status.replace("_", " ")}</span>
                {task.dueDate && <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>}
                <button
                  onClick={() => void removeTask(task.id)}
                  className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-300"
                  type="button"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
