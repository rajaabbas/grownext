"use client";

import { useMemo, useState } from "react";

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

const buildId = (() => {
  let counter = 0;
  return () => `task-${++counter}`;
})();

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");

  const completedCount = useMemo(() => tasks.filter((task) => task.completed).length, [tasks]);

  const addTask = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTasks((prev) => [...prev, { id: buildId(), title: trimmed, completed: false }]);
    setTitle("");
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
  };

  const removeTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Tasks</h1>
        <p className="text-slate-400">
          A lightweight sample product app wired into the centralized identity service. Add, toggle, and remove tasks
          locally to demonstrate product scaffolding.
        </p>
      </header>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-4 py-2 text-slate-100 focus:border-fuchsia-500 focus:outline-none"
            placeholder="Add a task"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button
            className="rounded-md bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
            disabled={!title.trim()}
            onClick={addTask}
            type="button"
          >
            Add task
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
          <span>Total: {tasks.length}</span>
          <span>Completed: {completedCount}</span>
        </div>

        <ul className="mt-6 space-y-3">
          {tasks.length === 0 && <li className="text-sm text-slate-500">No tasks yet. Create your first task above.</li>}
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
            >
              <label className="flex items-center gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-fuchsia-500 focus:ring-fuchsia-500"
                />
                <span className={task.completed ? "line-through text-slate-500" : ""}>{task.title}</span>
              </label>
              <button
                onClick={() => removeTask(task.id)}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-red-500 hover:text-red-300"
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
