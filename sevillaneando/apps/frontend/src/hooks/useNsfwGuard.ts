import { useCallback } from 'react';

// Placeholder: conecta NSFW.js/TensorFlow.js en el backend o en cliente antes de subir.
export function useNsfwGuard() {
  const evaluateImage = useCallback(async () => {
    // TODO: integrar nsfwjs y devolver true/false según umbral.
    // Por ahora devolvemos true para no bloquear la demo.
    return true;
  }, []);

  return { evaluateImage };
}
