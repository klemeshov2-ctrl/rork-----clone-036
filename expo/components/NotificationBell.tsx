import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, Cloud, CloudOff, ArrowUpDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '@/providers/ThemeProvider';
import { useComments } from '@/providers/CommentsProvider';
import { useChat } from '@/providers/ChatProvider';
import { useSyncPanel } from '@/providers/SyncPanelProvider';
import { useBackup } from '@/providers/BackupProvider';
import { useProfile } from '@/providers/ProfileProvider';
import { useObjects } from '@/providers/ObjectsProvider';
import { useInventory } from '@/providers/InventoryProvider';
import { useKnowledge } from '@/providers/KnowledgeProvider';
import { useTasks } from '@/providers/TasksProvider';

export function SyncHeaderButton({ size = 40 }: { size?: number }) {
  const colors = useThemeColors();
  const { open } = useSyncPanel();
  const { isConnected, isPublishing, isMasterSyncing, isSyncingSubscription, isRestoring, syncProgress } = useBackup();
  const { isSubscriberProfile, activeProfileId, profiles } = useProfile();

  const activeSubscriptionLetter = useMemo(() => {
    if (!isSubscriberProfile) return null;
    const profile = profiles.find(p => p.id === activeProfileId);
    if (!profile || !profile.name) return null;
    return profile.name.substring(0, 2).toUpperCase();
  }, [isSubscriberProfile, activeProfileId, profiles]);

  const isBusy = isPublishing || isMasterSyncing || !!isSyncingSubscription || isRestoring || !!syncProgress;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceElevated,
          borderColor: isBusy ? colors.warning + '80' : colors.border,
        },
      ]}
      onPress={open}
      activeOpacity={0.7}
      testID="sync-header-btn"
    >
      {syncProgress ? (
        <ArrowUpDown size={size * 0.5} color={colors.info} />
      ) : isConnected ? (
        <Cloud size={size * 0.5} color={isBusy ? colors.warning : colors.primary} />
      ) : (
        <CloudOff size={size * 0.5} color={colors.textMuted} />
      )}
      {isBusy && <View style={[styles.busyDot, { backgroundColor: colors.warning }]} />}
      {activeSubscriptionLetter && !isBusy && (
        <View style={[styles.subscriptionBadge, { backgroundColor: colors.primary, borderColor: colors.surfaceElevated }]}>
          <Text style={styles.subscriptionLetter}>{activeSubscriptionLetter}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function NotificationBell({ size = 40 }: { size?: number }) {
  const colors = useThemeColors();
  const { unreadCount: commentUnread } = useComments();
  const { unreadMessagesCount: chatUnread } = useChat();
  const { isSubscriberProfile, activeProfileId } = useProfile();
  const { objects, workEntries, documents } = useObjects();
  const { items: inventoryItems } = useInventory();
  const { items: knowledgeItems } = useKnowledge();
  const { tasks } = useTasks();
  const router = useRouter();

  const updatesSeenKey = useMemo(() => `@updates_seen_${activeProfileId}`, [activeProfileId]);
  const [lastSeen, setLastSeen] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(updatesSeenKey);
        if (!cancelled) setLastSeen(v ? parseInt(v, 10) || 0 : 0);
      } catch {}
    })();
    const interval = setInterval(async () => {
      try {
        const v = await AsyncStorage.getItem(updatesSeenKey);
        if (!cancelled) setLastSeen(v ? parseInt(v, 10) || 0 : 0);
      } catch {}
    }, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [updatesSeenKey]);

  const updatesUnread = useMemo<number>(() => {
    if (!isSubscriberProfile) return 0;
    let count = 0;
    objects.forEach(o => { const ts = o.updatedAt || o.createdAt; if (ts > lastSeen) count++; });
    Object.values(workEntries).forEach(arr => { arr.forEach(e => { if (e.createdAt > lastSeen) count++; }); });
    Object.values(documents).forEach(arr => { arr.forEach(d => { if (d.uploadedAt > lastSeen) count++; }); });
    inventoryItems.forEach(i => { const ts = i.updatedAt || i.createdAt; if (ts > lastSeen) count++; });
    knowledgeItems.forEach(k => { if (k.createdAt > lastSeen) count++; });
    tasks.forEach(t => { if (t.createdAt > lastSeen) count++; });
    return count;
  }, [isSubscriberProfile, objects, workEntries, documents, inventoryItems, knowledgeItems, tasks, lastSeen]);

  const totalUnread = commentUnread + chatUnread + updatesUnread;

  return (
    <View style={styles.row}>
      <SyncHeaderButton size={size} />
      <TouchableOpacity
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: totalUnread > 0 ? colors.error + '22' : colors.surfaceElevated,
            borderColor: totalUnread > 0 ? colors.error : colors.border,
          },
        ]}
        onPress={() => router.push('/notifications' as any)}
        activeOpacity={0.7}
        testID="notification-bell"
      >
        <Bell size={size * 0.5} color={totalUnread > 0 ? colors.error : colors.text} fill={totalUnread > 0 ? colors.error : 'transparent'} />
        {totalUnread > 0 && (
          <View
            style={[
              styles.badge,
              { backgroundColor: colors.error },
            ]}
          >
            <Text style={styles.badgeText}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  busyDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  subscriptionBadge: {
    position: 'absolute',
    bottom: -4,
    right: -6,
    minWidth: 24,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: 4,
  },
  subscriptionLetter: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 16,
    letterSpacing: -0.3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
