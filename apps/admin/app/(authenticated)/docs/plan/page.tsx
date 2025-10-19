import Link from "next/link";

const planPath = "/docs/overview/super-admin-app-plan.md";

const phases = [
  { number: 1, title: "Discovery & Design", status: "Completed" },
  { number: 2, title: "Backend Enablement", status: "Completed" },
  { number: 3, title: "Frontend Scaffold", status: "Completed" },
  { number: 4, title: "Auth & Access Control", status: "Completed" },
  { number: 5, title: "Core User Management", status: "Completed" },
  { number: 6, title: "Advanced Tooling", status: "Completed" },
  { number: 7, title: "Hardening & Observability", status: "Completed" },
  { number: 8, title: "QA & Rollout", status: "Completed" }
];

export default function DeliveryPlanPage() {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold tracking-tight">Delivery Plan</h2>
        <p className="text-sm text-muted-foreground">
          Snapshot of the Super Admin roadmap. Refer to the master document for the full breakdown of workstreams, deliverables, and risks.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="divide-y divide-border">
          {phases.map((phase) => (
            <div key={phase.number} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Phase {phase.number}: {phase.title}
                </p>
                <p className="text-xs text-muted-foreground">Status: {phase.status}</p>
              </div>
              <span
                className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                aria-label={`Phase ${phase.number} ${phase.status}`}
              >
                {phase.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        Review the{" "}
        <Link href={planPath} className="font-medium text-primary underline">
          full implementation plan
        </Link>{" "}
        for detailed goals, workstreams, deliverables, and risk mitigations.
      </div>
    </div>
  );
}
