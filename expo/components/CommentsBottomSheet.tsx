import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Keyboard,
} from 'react-native';
import { MessageCircle, Send, RefreshCw, X } from 'lucide-react-native';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';
import { useComments } from '@/providers/CommentsProvider';
import { useBackup } from '@/providers/BackupProvider';
import type { Comment, CommentEntityType } from '@/types';

interface CommentsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  entityType: CommentEntityType;
  entityId: string;
  title?: string;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
    <Animated.View style={{ opacity: fadeAnim, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row' as const, alignItems: isOwn ? 'flex-end' as const : 'flex-start' as const }}>
        {!isOwn && (
          <View style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.primary + '25',
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            marginRight: 10,
            marginTop: 2,
          }}>
            <Text style={{ fontSize: 14, fontWeight: '700' as const, color: colors.primary }}>
              {getInitial(comment)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{
            backgroundColor: isOwn ? colors.primary + '18' : colors.surfaceElevated,
            borderRadius: 16,
            borderTopLeftRadius: isOwn ? 16 : 4,
            borderTopRightRadius: isOwn ? 4 : 16,
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxWidth: '88%',
            alignSelf: isOwn ? 'flex-end' as const : 'flex-start' as const,
            borderWidth: 1,
            borderColor: isOwn ? colors.primary + '20' : colors.border,
          }}>
            {!isOwn && (
              <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '600' as const, marginBottom: 3 }} numberOfLines={1}>
                {authorLabel}
              </Text>
            )}
            <Text style={{ fontSize: 15, color: colors.text, lineHeight: 21 }}>{comment.text}</Text>
          </View>
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 3, alignSelf: isOwn ? 'flex-end' as const : 'flex-start' as const, marginHorizontal: 6 }}>
            <Text style={{ fontSize: 10, color: colors.textMuted }}>
              {formatCommentDate(comment.createdAt)}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function CommentsBottomSheet({ visible, onClose, entityType, entityId, title }: CommentsBottomSheetProps) {
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
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const key = `${entityType}:${String(entityId)}`;
  const comments = commentsMap[key] || [];

  useEffect(() => {
    if (visible && entityId) {
      console.log('[CommentsBottomSheet] Loading comments for', entityType, entityId);
      loadComments(entityType, String(entityId));
    }
  }, [visible, entityType, entityId, loadComments]);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }, [slideAnim, onClose]);

  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;
    setInputText('');
    Keyboard.dismiss();
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

  const displayTitle = title || 'Комментарии';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.backdropTouch}
          activeOpacity={1}
          onPress={handleClose}
        />
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
        >
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.handleBar} />

            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <MessageCircle size={20} color={colors.primary} />
                <Text style={styles.sheetTitle}>{displayTitle}</Text>
                {comments.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{comments.length}</Text>
                  </View>
                )}
              </View>
              <View style={styles.sheetHeaderRight}>
                <TouchableOpacity onPress={handleRefresh} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <RefreshCw size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClose} style={styles.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.commentsBody}>
              {isLoading && comments.length === 0 ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.centerText}>Загрузка...</Text>
                </View>
              ) : comments.length === 0 ? (
                <View style={styles.centerContainer}>
                  <View style={styles.emptyIcon}>
                    <MessageCircle size={36} color={colors.textMuted} />
                  </View>
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
            </View>

            {isAuthenticated ? (
              <View style={styles.inputContainer}>
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
                    onFocus={() => {
                      setTimeout(() => {
                        listRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
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
              </View>
            ) : (
              <View style={styles.authPending}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.authPendingText}>Подключение...</Text>
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
    },
    backdropTouch: {
      flex: 1,
    },
    keyboardAvoid: {
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: SCREEN_HEIGHT * 0.85,
      minHeight: SCREEN_HEIGHT * 0.45,
      overflow: 'hidden',
    },
    handleBar: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted + '40',
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 6,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    sheetHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    sheetHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: colors.text,
    },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 22,
      height: 22,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 7,
    },
    badgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '700' as const,
    },
    headerBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    commentsBody: {
      flex: 1,
      minHeight: 120,
    },
    centerContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    centerText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '500' as const,
    },
    emptySubtext: {
      fontSize: 13,
      color: colors.textMuted,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
      backgroundColor: colors.background,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: 16,
      paddingRight: 6,
      paddingVertical: 4,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      maxHeight: 100,
      paddingVertical: 8,
      lineHeight: 21,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    sendBtnDisabled: {
      opacity: 0.35,
    },
    authPending: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    authPendingText: {
      fontSize: 13,
      color: colors.textMuted,
    },
  });
}
