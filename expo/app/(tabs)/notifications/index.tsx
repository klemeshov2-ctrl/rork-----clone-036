import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { Bell, Check, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';
import { useComments } from '@/providers/CommentsProvider';
import { useObjects } from '@/providers/ObjectsProvider';
import type { Comment, CommentEntityType } from '@/types';

function formatCommentDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const time = `${hours}:${minutes}`;
  if (isToday) return `Сегодня, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) return `Вчера, ${time}`;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}, ${time}`;
}

function getEntityLabel(type: CommentEntityType): string {
  switch (type) {
    case 'work_entry': return 'Запись работ';
    case 'inventory': return 'Склад';
    case 'task': return 'Задача';
    default: return 'Комментарий';
  }
}

function UnreadCommentCard({
  comment,
  colors,
  onPress,
}: {
  comment: Comment;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.primary + '25',
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 8 }}>
        <View style={{
          backgroundColor: colors.primary + '15',
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 3,
          marginRight: 8,
        }}>
          <Text style={{ fontSize: 11, fontWeight: '600' as const, color: colors.primary }}>
            {getEntityLabel(comment.entityType)}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
          {formatCommentDate(comment.createdAt)}
        </Text>
        <ChevronRight size={16} color={colors.textMuted} />
      </View>
      <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 4 }} numberOfLines={3}>
        {comment.text}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
        {comment.userName || comment.userEmail || 'Аноним'}
      </Text>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { unreadComments, markAsRead, markAllAsRead } = useComments();
  const { getWorkEntry } = useObjects();
  const router = useRouter();

  const navigateToComment = useCallback((comment: Comment) => {
    markAsRead(comment.id);

    console.log('[Notifications] Navigating to comment:', comment.entityType, comment.entityId);

    switch (comment.entityType) {
      case 'work_entry': {
        const entry = getWorkEntry(comment.entityId);
        if (entry) {
          router.push({
            pathname: '/(home)/object-detail' as any,
            params: { id: entry.objectId, highlightComment: comment.entityId },
          });
        }
        break;
      }
      case 'inventory': {
        router.navigate('/(tabs)/inventory' as any);
        break;
      }
      case 'task': {
        router.push({
          pathname: '/reminders/create' as any,
          params: { editId: comment.entityId },
        });
        break;
      }
      default:
        break;
    }
  }, [markAsRead, getWorkEntry, router]);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const renderItem = useCallback(({ item }: { item: Comment }) => (
    <UnreadCommentCard
      comment={item}
      colors={colors}
      onPress={() => navigateToComment(item)}
    />
  ), [colors, navigateToComment]);

  const keyExtractor = useCallback((item: Comment) => item.id, []);

  return (
    <View style={styles.container}>
      {unreadComments.length > 0 && (
        <View style={styles.headerActions}>
          <Text style={styles.countText}>
            {unreadComments.length} непрочитанных
          </Text>
          <TouchableOpacity
            style={styles.markAllBtn}
            onPress={handleMarkAllRead}
            activeOpacity={0.7}
          >
            <Check size={14} color={colors.primary} />
            <Text style={styles.markAllText}>Прочитать все</Text>
          </TouchableOpacity>
        </View>
      )}

      {unreadComments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Bell size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Нет уведомлений</Text>
          <Text style={styles.emptySubtext}>
            Новые комментарии будут отображаться здесь
          </Text>
        </View>
      ) : (
        <FlatList
          data={unreadComments}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    countText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    markAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    markAllText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 10,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 4,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    listContent: {
      padding: 16,
    },
  });
}
