const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export const getApiBaseUrl = () => API_BASE_URL;

export const apiFetch = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response;
};

export const apiFetchWithAuth = async (path: string, accessToken: string, init?: RequestInit) => {
  return apiFetch(path, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });
};
