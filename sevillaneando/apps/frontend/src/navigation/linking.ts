import * as ExpoLinking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

const shareBaseUrl = process.env.EXPO_PUBLIC_SHARE_BASE_URL?.replace(/\/$/, '');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    ExpoLinking.createURL('/'),
    'sevillaneando://',
    ...(shareBaseUrl ? [shareBaseUrl] : []),
  ],
  config: {
    screens: {
      Home: '',
      EventDetailLink: 'evento/:eventId',
      AccessPrivateEvent: 'acceso/:linkAcceso',
    },
  },
};
