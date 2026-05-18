import i18n from '../i18n/i18n';

const FIREBASE_ERROR_KEY_MAP: Record<string, string> = {
  'auth/invalid-email': 'firebase.invalidEmail',
  'auth/user-not-found': 'firebase.userNotFound',
  'auth/wrong-password': 'firebase.wrongPassword',
  'auth/invalid-credential': 'firebase.invalidCredential',
  'auth/email-already-in-use': 'firebase.emailInUse',
  'auth/weak-password': 'firebase.weakPassword',
  'auth/too-many-requests': 'firebase.tooManyRequests',
  'auth/user-disabled': 'firebase.userDisabled',
  'auth/network-request-failed': 'firebase.networkFailed',
  'auth/popup-closed-by-user': 'firebase.popupClosed',
  'auth/requires-recent-login': 'firebase.requiresRecentLogin',
  'auth/account-exists-with-different-credential': 'firebase.accountExistsDifferentCredential',
  'auth/missing-email': 'firebase.missingEmail',
  'auth/missing-password': 'firebase.missingPassword',
  'auth/operation-not-allowed': 'firebase.operationNotAllowed',
};

export function getFirebaseErrorMessage(err: unknown): string {
  const code = (err as any)?.code as string | undefined;
  if (code && FIREBASE_ERROR_KEY_MAP[code]) {
    return i18n.t(FIREBASE_ERROR_KEY_MAP[code]);
  }
  return i18n.t('firebase.unknownError');
}
