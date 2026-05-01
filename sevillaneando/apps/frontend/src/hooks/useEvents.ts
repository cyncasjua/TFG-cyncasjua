import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getEvents, getEventByAccessLink } from '../services/api';
import type { Event } from '../types/event';
import { reportError } from '../utils/telemetry';
import { getErrorMessage } from '../services/api';

type EventWithDistance = Event & { distance?: number };

const CACHE_KEY = 'events_cache_v1';
const ACCESSED_PRIVATE_LINKS_KEY = 'accessedPrivateLinks';
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutos

type CacheEntry = {
  timestamp: number;
  events: EventWithDistance[];
  cacheKey: string;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildCacheKey(userId?: string, lat?: number, lng?: number): string {
  return `${userId ?? 'anon'}_${lat?.toFixed(3) ?? 'x'}_${lng?.toFixed(3) ?? 'x'}`;
}

async function readCache(cacheKey: string): Promise<EventWithDistance[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (entry.cacheKey !== cacheKey) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.events;
  } catch {
    return null;
  }
}

async function writeCache(cacheKey: string, events: EventWithDistance[]): Promise<void> {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), cacheKey, events };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // ignorar fallos de escritura en caché
  }
}

export function useEvents(user: { id?: string; ubicacion?: { coordinates?: number[] } } | null) {
  const [items, setItems] = useState<EventWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const doFetch = useCallback(
    async (opts: { forceRefresh?: boolean; showLoadingSpinner?: boolean } = {}) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      const { forceRefresh = false, showLoadingSpinner = true } = opts;

      const userLat = user?.ubicacion?.coordinates?.[1];
      const userLon = user?.ubicacion?.coordinates?.[0];
      const hasLocation = userLat != null && userLon != null;
      const cacheKey = buildCacheKey(user?.id, userLat, userLon);

      if (!forceRefresh) {
        const cached = await readCache(cacheKey);
        if (cached) {
          setItems(cached);
          setLoading(false);
          // Revalidar en background sin spinner (sin bloquear fetchingRef)
          setTimeout(() => doFetch({ forceRefresh: true, showLoadingSpinner: false }), 0);
          fetchingRef.current = false;
          return;
        }
      }

      if (showLoadingSpinner) setLoading(true);
      setError(null);

      try {
        const { events: publicEvents } = await getEvents(
          user?.id,
          hasLocation ? { lat: userLat, lng: userLon } : undefined,
        );

        const raw = await AsyncStorage.getItem(ACCESSED_PRIVATE_LINKS_KEY);
        const links: string[] = raw ? JSON.parse(raw) : [];

        const privateResults = await Promise.allSettled(
          links.map((link) => getEventByAccessLink(link)),
        );
        const privateEvents: Event[] = privateResults
          .filter((r): r is PromiseFulfilledResult<Event> => r.status === 'fulfilled')
          .map((r) => r.value);

        const remote = [...publicEvents, ...privateEvents].filter(
          (ev, idx, arr) => idx === arr.findIndex((e) => e.id === ev.id),
        );

        let result: EventWithDistance[];
        if (hasLocation) {
          result = remote
            .map((ev) => {
              const serverDist = (ev as any).distanceKm;
              if (serverDist != null) return { ...ev, distance: Number(serverDist) };
              if (!ev.location?.coordinates || ev.location.coordinates.length !== 2)
                return { ...ev, distance: Infinity };
              return {
                ...ev,
                distance: haversineKm(
                  userLat,
                  userLon,
                  ev.location.coordinates[1],
                  ev.location.coordinates[0],
                ),
              };
            })
            .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        } else {
          result = remote as EventWithDistance[];
        }

        setItems(result);
        await writeCache(cacheKey, result);
      } catch (err) {
        reportError('useEvents.fetch', 'Error cargando eventos', err);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
        fetchingRef.current = false;
      }
    },
    [user],
  );

  const fetchEvents = useCallback(
    (opts?: { forceRefresh?: boolean }) => doFetch({ showLoadingSpinner: true, ...opts }),
    [doFetch],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    doFetch({ forceRefresh: true, showLoadingSpinner: false });
  }, [doFetch]);

  return { items, setItems, loading, refreshing, error, fetchEvents, onRefresh };
}
