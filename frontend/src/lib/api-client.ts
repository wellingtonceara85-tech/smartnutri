const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3021';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions extends RequestInit {
  accessToken?: string | null;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { accessToken, headers, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'message' in body) {
        const bodyMessage = (body as { message: unknown }).message;
        message = Array.isArray(bodyMessage) ? bodyMessage.join(', ') : String(bodyMessage);
      }
    } catch {
      // resposta sem corpo JSON — mantém statusText
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
