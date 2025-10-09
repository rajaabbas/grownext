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
  const apiHealthUrl = process.env.E2E_API_HEALTH_URL ?? "http://localhost:3001/health";
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    if (await checkHealth(apiHealthUrl)) {
      return;
    }
    await wait(1_000);
  }

  throw new Error(`Timed out waiting for API health endpoint at ${apiHealthUrl}`);
}
