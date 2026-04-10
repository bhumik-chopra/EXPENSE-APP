import { getApiBaseUrl } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

type RequestOptions = RequestInit & {
  headers?: Record<string, string>;
};

const normalizeError = (error: unknown) => {
  if (error instanceof ApiError) return error;

  if (error instanceof Error && error.message.includes('Network request failed')) {
    return new ApiError('Backend temporarily unavailable. Please try again in a moment.');
  }

  return new ApiError('Something went wrong while contacting the server.');
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
    });

    const payload = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new ApiError(payload?.error ?? payload?.message ?? 'Request failed.', response.status);
    }

    return payload as T;
  } catch (error) {
    throw normalizeError(error);
  }
}
