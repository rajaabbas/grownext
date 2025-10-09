import { Card, CardContent, CardHeader } from "@ma/ui";
import { HealthResponseSchema } from "@ma/contracts";
import { apiFetch } from "@/lib/api";

export default async function HealthPage() {
  let health: ReturnType<typeof HealthResponseSchema.parse> | null = null;
  let errorMessage: string | null = null;

  try {
    const response = await apiFetch("/health");
    const payload = await response.json();
    health = HealthResponseSchema.parse(payload);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unable to load API status.";
  }

  return (
    <Card data-testid="health-card">
      <CardHeader>
        <h1 className="text-2xl font-semibold" data-testid="health-heading">
          API Health
        </h1>
      </CardHeader>
      <CardContent className="space-y-4" data-testid="health-content">
        <p>
          Status:{" "}
          <span
            className={`font-semibold ${health ? "text-emerald-600" : "text-amber-600"}`}
            data-testid="health-status"
          >
            {health?.status ?? "unavailable"}
          </span>
        </p>
        <p data-testid="health-time">
          Current time:{" "}
          {health ? new Date(health.time).toLocaleString() : "Waiting for API response"}
        </p>
        <p data-testid="health-uptime">
          API uptime: {health ? `${Math.round(health.uptime)} seconds` : "—"}
        </p>
        {errorMessage ? (
          <p className="text-sm text-amber-600" data-testid="health-error">
            {errorMessage}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
