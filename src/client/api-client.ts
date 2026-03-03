import { getAccessToken } from "../auth/google-auth.js";

const BASE_URL = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
    errors?: Array<{ message: string; domain: string; reason: string }>;
  };
}

export interface PaginatedResponse<T> {
  tokenPagination?: {
    nextPageToken?: string;
  };
  [key: string]: unknown;
}

export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail: string
  ) {
    super(`Google Play API Error [${status}] ${code}: ${detail}`);
    this.name = "APIError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = (await response.json()) as GoogleErrorResponse;
      if (errorBody.error) {
        throw new APIError(
          errorBody.error.code,
          errorBody.error.status,
          errorBody.error.message
        );
      }
    } catch (e) {
      if (e instanceof APIError) throw e;
    }

    if (response.status === 401) {
      throw new APIError(401, "UNAUTHENTICATED", "OAuth2 token invalid or expired. Check your service account key.");
    }
    if (response.status === 403) {
      throw new APIError(403, "PERMISSION_DENIED", "Insufficient permissions. Ensure the service account has Play Console access.");
    }
    if (response.status === 429) {
      throw new APIError(429, "RATE_LIMITED", "Rate limited by Google. Try again in a moment.");
    }

    throw new APIError(response.status, "UNKNOWN", errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function gpGet<T>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const token = await getAccessToken();
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return handleResponse<T>(response);
}

export async function gpPost<T>(
  path: string,
  body: unknown
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function gpPut<T>(
  path: string,
  body: unknown
): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function gpDelete(path: string): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    await handleResponse(response);
  }
}
