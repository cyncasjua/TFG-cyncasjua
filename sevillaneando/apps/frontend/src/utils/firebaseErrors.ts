const FIREBASE_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'El formato del email no es válido.',
  'auth/user-not-found': 'No existe ninguna cuenta con este email.',
  'auth/wrong-password': 'La contraseña es incorrecta.',
  'auth/invalid-credential': 'Email o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con este email.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  'auth/user-disabled': 'Esta cuenta ha sido desactivada. Contacta con soporte.',
  'auth/network-request-failed': 'Error de conexión. Comprueba tu internet e inténtalo de nuevo.',
  'auth/popup-closed-by-user': 'Inicio de sesión cancelado.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión antes de realizar esta acción.',
  'auth/account-exists-with-different-credential': 'Ya existe una cuenta con este email usando otro método de inicio de sesión.',
  'auth/missing-email': 'Introduce tu email.',
  'auth/missing-password': 'Introduce tu contraseña.',
  'auth/operation-not-allowed': 'Este método de inicio de sesión no está habilitado.',
};

export function getFirebaseErrorMessage(err: unknown): string {
  const code = (err as any)?.code as string | undefined;
  if (code && FIREBASE_ERROR_MESSAGES[code]) {
    return FIREBASE_ERROR_MESSAGES[code];
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
