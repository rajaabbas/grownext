const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const checkHealth = async (url: string) => {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    console.warn(`Waiting for ${url}:`, (error as Error).message);
    return false;
  }
};

export default async function globalSetup() {
  const apiHealthUrl = process.env.E2E_API_HEALTH_URL ?? "http://localhost:3100/health";
  const portalHealthUrl = process.env.E2E_PORTAL_HEALTH_URL;
  const tasksHealthUrl = process.env.E2E_TASKS_HEALTH_URL;

  const healthChecks = [apiHealthUrl, portalHealthUrl, tasksHealthUrl].filter(
    (value): value is string => Boolean(value && value.trim().length > 0)
  );
  const deadline = Date.now() + 120_000;

  for (const url of healthChecks) {
    const target = url.trim();
    if (!target) continue;

    let healthy = false;
    while (Date.now() < deadline) {
      healthy = await checkHealth(target);
      if (healthy) break;
      await wait(1_000);
    }

    if (!healthy) {
      throw new Error(`Timed out waiting for health endpoint at ${target}`);
    }
  }
}
