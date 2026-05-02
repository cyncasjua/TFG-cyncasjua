import axios, { AxiosError } from 'axios';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Error desconocido';

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;

    if (axiosError.response?.data?.message && typeof axiosError.response.data.message === 'string') {
      return axiosError.response.data.message;
    }

    if (Array.isArray(axiosError.response?.data?.message)) {
      const messages = axiosError.response.data.message as string[];
      return messages.join('. ');
    }

    if (axiosError.response?.data?.error && typeof axiosError.response.data.error === 'string') {
      return axiosError.response.data.error;
    }

    if (axiosError.response?.status === 400) {
      const details = axiosError.response?.data?.message || 'Solicitud inválida';
      if (Array.isArray(details)) {
        return details.join('. ');
      }
      return String(details);
    }

    if (axiosError.response?.status === 401) {
      return 'No autorizado. Por favor, inicia sesión nuevamente.';
    }

    if (axiosError.response?.status === 403) {
      return 'Acceso denegado. No tienes permisos.';
    }

    if (axiosError.response?.status === 404) {
      return 'Recurso no encontrado.';
    }

    if (axiosError.response?.status === 500) {
      return 'Error del servidor. Intenta más tarde.';
    }

    if (axiosError.code === 'ECONNABORTED') {
      return 'La solicitud tardó demasiado. Verifica tu conexión.';
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function setAuthToken(token: string) {
  if (!token) {
    delete api.defaults.headers.common.Authorization;
  } else {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  }
}
