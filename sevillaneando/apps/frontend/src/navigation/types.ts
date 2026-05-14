import type { Event } from '../types/event';
import type { RecommendedRoute } from '../services';

export type RootStackParamList = {
  Home: undefined;
  EventDetail: { event: Event };
  EventDetailLink: { eventId: string };
  Admin: undefined;
  EditProfile: undefined;
  EditPassword: undefined;
  CreateEvent: undefined;
  EditEvent: { event: Event };
  ModeratorEvents: undefined;
  ModeratorEditEvent: { event: Event };
  Notifications: undefined;
  Categories: undefined;
  EventsMap: undefined;
  UserProfile: { userId: string };
  DirectMessage: { userId: string; userName: string };
  Messages: undefined;
  AccessPrivateEvent: { linkAcceso: string };
  UserEvents: undefined;
  CalendarEvents: undefined;
  RoutePreview: { routePlan: RecommendedRoute };
  Routes: undefined;
  CreateRoute: undefined;
  RouteDetail: { routeId: string };
  SavedAndPrivateEvents: { mode?: 'saved' | 'private' | 'both' | 'joined' };
  LegalAttributions: undefined;
  PrivacyPolicy: undefined;
  Help: undefined;
  Friends: undefined;
  ProfileConnections: { userId: string; type: 'seguidores' | 'seguidos' };
};

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  PrivacyPolicy: undefined;
};
