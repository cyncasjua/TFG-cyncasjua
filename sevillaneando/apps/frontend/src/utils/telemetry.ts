type TelemetryLevel = 'error' | 'warning';

type TelemetryPayload = {
  level: TelemetryLevel;
  scope: string;
  message: string;
  error?: unknown;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

type TelemetryListener = (payload: TelemetryPayload) => void;

const listeners = new Set<TelemetryListener>();

export function subscribeTelemetry(listener: TelemetryListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publish(payload: TelemetryPayload) {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (err) {
      void err;
    }
  });
}

export function reportError(
  scope: string,
  message: string,
  error?: unknown,
  metadata?: Record<string, unknown>,
) {
  publish({
    level: 'error',
    scope,
    message,
    error,
    metadata,
    timestamp: new Date().toISOString(),
  });
}

export function reportWarning(
  scope: string,
  message: string,
  error?: unknown,
  metadata?: Record<string, unknown>,
) {
  publish({
    level: 'warning',
    scope,
    message,
    error,
    metadata,
    timestamp: new Date().toISOString(),
  });
}
