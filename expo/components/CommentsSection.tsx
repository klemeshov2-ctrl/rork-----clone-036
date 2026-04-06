import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { MessageCircle, Send, RefreshCw } from 'lucide-react-native';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';
import { useComments } from '@/providers/CommentsProvider';
import { useBackup } from '@/providers/BackupProvider';
import type { Comment, CommentEntityType } from '@/types';

interface CommentsSectionProps {
  entityType: CommentEntityType;
  entityId: string;
}

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
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return `Вчера, ${time}`;

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}, ${time}`;
}

function getDisplayLabel(comment: Comment): string {
  if (comment.userName && comment.userName !== 'Аноним') return comment.userName;
  if (comment.userEmail) return comment.userEmail;
  return 'Аноним';
}

function getInitial(comment: Comment): string {
  const label = getDisplayLabel(comment);
  return (label?.[0] || '?').toUpperCase();
}

function CommentBubble({ comment, colors, isOwn }: { comment: Comment; colors: ThemeColors; isOwn: boolean }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const authorLabel = getDisplayLabel(comment);

  return (
    <Animated.View style={[{ opacity: fadeAnim, marginBottom: 12 }]}>
      <View style={{ flexDirection: 'row' as const, alignItems: isOwn ? 'flex-end' as const : 'flex-start' as const }}>
        {!isOwn && (
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.primary + '30',
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            marginRight: 8,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700' as const, color: colors.primary }}>
              {getInitial(comment)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{
            backgroundColor: isOwn ? colors.primary + '18' : colors.surfaceElevated,
            borderRadius: 14,
            borderTopLeftRadius: isOwn ? 14 : 4,
            borderTopRightRadius: isOwn ? 4 : 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxWidth: '90%',
            alignSelf: isOwn ? 'flex-end' as const : 'flex-start' as const,
            borderWidth: 1,
            borderColor: isOwn ? colors.primary + '25' : colors.border,
          }}>
            {!isOwn && (
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' as const, marginBottom: 4 }} numberOfLines={1}>
                {authorLabel}
              </Text>
            )}
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{comment.text}</Text>
          </View>
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 3, alignSelf: isOwn ? 'flex-end' as const : 'flex-start' as const, marginHorizontal: 4 }}>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>
              {formatCommentDate(comment.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function CommentsSection({ entityType, entityId }: CommentsSectionProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    comments: commentsMap,
    loadComments,
    addComment,
    isLoading,
    isSending,
    isAuthenticated,
    userId,
  } = useComments();
  const { userEmail } = useBackup();

  const [inputText, setInputText] = useState('');
  const listRef = useRef<FlatList>(null);

  const key = `${entityType}:${String(entityId)}`;
  const comments = commentsMap[key] || [];

  useEffect(() => {
    console.log('[CommentsSection] Loading comments for', entityType, entityId);
    loadComments(entityType, String(entityId));
  }, [entityType, entityId, loadComments]);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    setInputText('');
    await addComment(entityType, String(entityId), trimmed);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }, [inputText, isSending, addComment, entityType, entityId]);

  const handleRefresh = useCallback(() => {
    loadComments(entityType, String(entityId));
  }, [loadComments, entityType, entityId]);

  const renderComment = useCallback(({ item }: { item: Comment }) => {
    const isOwn = item.userId === userId || item.userEmail === userEmail;
    return <CommentBubble comment={item} colors={colors} isOwn={isOwn} />;
  }, [userId, userEmail, colors]);

  const keyExtractor = useCallback((item: Comment) => item.id, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MessageCircle size={18} color={colors.primary} />
          <Text style={styles.headerTitle}>Комментарии</Text>
          {comments.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{comments.length}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <RefreshCw size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {isLoading && comments.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Загрузка комментариев...</Text>
        </View>
      ) : comments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MessageCircle size={32} color={colors.textMuted} />
          <Text style={styles.emptyText}>Нет комментариев</Text>
          <Text style={styles.emptySubtext}>Будьте первым!</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={comments}
          renderItem={renderComment}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: false });
          }}
        />
      )}

      {isAuthenticated ? (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Написать комментарий..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            editable={!isSending}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isSending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.authPending}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.authPendingText}>Подключение к серверу комментариев...</Text>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginTop: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700',
    },
    refreshBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      gap: 10,
    },
    loadingText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 6,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    emptySubtext: {
      fontSize: 12,
      color: colors.textMuted,
    },
    list: {
      maxHeight: 300,
    },
    listContent: {
      paddingVertical: 4,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginTop: 8,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: 14,
      paddingRight: 6,
      paddingVertical: 6,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      maxHeight: 80,
      paddingVertical: 6,
      lineHeight: 20,
    },
    sendBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnDisabled: {
      opacity: 0.4,
    },
    authPending: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    authPendingText: {
      fontSize: 13,
      color: colors.textMuted,
      flex: 1,
    },
  });
}
