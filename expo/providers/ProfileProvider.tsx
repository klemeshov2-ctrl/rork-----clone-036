import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import type { MasterSubscription, AppProfile, ProfileMode } from '@/types';

let _isSubscriberFlag = false;
let _lastAlertAt = 0;

/**
 * Returns true if the current profile is a subscriber view and shows a read-only alert.
 * Use as an early guard inside provider mutations: `if (assertNotSubscriber()) return;`
 */
export function assertNotSubscriber(): boolean {
  if (!_isSubscriberFlag) return false;
  const now = Date.now();
  if (now - _lastAlertAt > 600) {
    _lastAlertAt = now;
    Alert.alert(
      'Только просмотр',
      'Подписчик не может редактировать и менять данные. Доступны только комментарии и чат с мастером.'
    );
  }
  return true;
}

export function isSubscriberView(): boolean {
  return _isSubscriberFlag;
}

const PROFILE_MODE_KEY = '@profile_mode';
const ACTIVE_PROFILE_KEY = '@active_profile_id';
const SUBSCRIPTIONS_KEY = '@sync_subscriptions';

interface ProfileContextType {
  mode: ProfileMode;
  activeProfileId: string;
  profiles: AppProfile[];
  isSubscriberProfile: boolean;
  isLoaded: boolean;
  setMode: (mode: ProfileMode) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

export const [ProfileProvider, useProfile] = createContextHook<ProfileContextType>(() => {
  const [mode, setModeState] = useState<ProfileMode>('master');
  const [activeProfileId, setActiveProfileId] = useState<string>('master');
  const [subscriptions, setSubscriptions] = useState<MasterSubscription[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [storedMode, storedProfile, storedSubs] = await Promise.all([
        AsyncStorage.getItem(PROFILE_MODE_KEY),
        AsyncStorage.getItem(ACTIVE_PROFILE_KEY),
        AsyncStorage.getItem(SUBSCRIPTIONS_KEY),
      ]);

      if (storedMode === 'subscriber') setModeState('subscriber');
      if (storedProfile) setActiveProfileId(storedProfile);

      if (storedSubs) {
        try {
          setSubscriptions(JSON.parse(storedSubs));
        } catch (e) {
          console.log('[Profile] Failed to parse subscriptions:', e);
        }
      }
    } catch (e) {
      console.log('[Profile] Error loading:', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const profiles = useMemo<AppProfile[]>(() => {
    const list: AppProfile[] = [{ id: 'master', name: 'Мои данные', type: 'master' }];
    subscriptions.forEach(s => {
      list.push({ id: s.id, name: s.name, type: 'subscription' });
    });
    return list;
  }, [subscriptions]);

  const isSubscriberProfile = activeProfileId !== 'master';

  useEffect(() => {
    _isSubscriberFlag = isSubscriberProfile;
  }, [isSubscriberProfile]);

  const setMode = useCallback(async (newMode: ProfileMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem(PROFILE_MODE_KEY, newMode);
    if (newMode === 'master') {
      setActiveProfileId('master');
      await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, 'master');
    }
    console.log('[Profile] Mode set to:', newMode);
  }, []);

  const switchProfile = useCallback(async (id: string) => {
    console.log('[Profile] Switching to profile:', id);
    setActiveProfileId(id);
    await AsyncStorage.setItem(ACTIVE_PROFILE_KEY, id);
    if (id === 'master') {
      setModeState('master');
      await AsyncStorage.setItem(PROFILE_MODE_KEY, 'master');
    } else {
      setModeState('subscriber');
      await AsyncStorage.setItem(PROFILE_MODE_KEY, 'subscriber');
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      const storedSubs = await AsyncStorage.getItem(SUBSCRIPTIONS_KEY);
      if (storedSubs) {
        const parsed = JSON.parse(storedSubs) as MasterSubscription[];
        setSubscriptions(parsed);
        console.log('[Profile] Refreshed profiles, subscriptions:', parsed.length);
      } else {
        setSubscriptions([]);
      }
    } catch (e) {
      console.log('[Profile] Error refreshing profiles:', e);
    }
  }, []);

  return useMemo(() => ({
    mode,
    activeProfileId,
    profiles,
    isSubscriberProfile,
    isLoaded,
    setMode,
    switchProfile,
    refreshProfiles,
  }), [mode, activeProfileId, profiles, isSubscriberProfile, isLoaded, setMode, switchProfile, refreshProfiles]);
});

export function useSubscriberGuard() {
  const { isSubscriberProfile } = useProfile();

  const guardEdit = useCallback((): Promise<boolean> => {
    if (!isSubscriberProfile) return Promise.resolve(true);
    return new Promise(resolve => {
      Alert.alert(
        'Только просмотр',
        'В режиме подписчика нельзя редактировать или менять данные. Доступны только комментарии и чат с мастером.',
        [{ text: 'Понятно', onPress: () => resolve(false) }]
      );
    });
  }, [isSubscriberProfile]);

  const blockIfSubscriber = useCallback((): boolean => {
    if (!isSubscriberProfile) return false;
    Alert.alert(
      'Только просмотр',
      'В режиме подписчика нельзя редактировать или менять данные. Доступны только комментарии и чат с мастером.'
    );
    return true;
  }, [isSubscriberProfile]);

  return { isSubscriberProfile, guardEdit, blockIfSubscriber };
}
