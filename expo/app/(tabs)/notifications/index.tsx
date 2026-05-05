import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Bell, Check, ChevronRight, MessageCircle, MessageSquare, Send, Trash2, Users, Sparkles, Building2, Package, BookOpen, Wrench, ClipboardList, FileText, Image as ImageIcon, Paperclip } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';
import { useComments } from '@/providers/CommentsProvider';
import { useChat } from '@/providers/ChatProvider';
import { useObjects } from '@/providers/ObjectsProvider';
import { useInventory } from '@/providers/InventoryProvider';
import { useKnowledge } from '@/providers/KnowledgeProvider';
import { useTasks } from '@/providers/TasksProvider';
import type { Comment, CommentEntityType, ChatMessage, FirestoreSubscription } from '@/types';
import { useBackup } from '@/providers/BackupProvider';
import { useProfile } from '@/providers/ProfileProvider';

function formatDate(ts: number): string {
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

function formatMessageTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const time = `${hours}:${minutes}`;
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) return time;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  ) return `Вчера, ${time}`;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month} ${time}`;
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
          {formatDate(comment.createdAt)}
        </Text>
        <ChevronRight size={16} color={colors.textMuted} />
      </View>
      <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 4 }} numberOfLines={3}>
        {comment.text}
      </Text>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
        {comment.authorName || comment.userName || comment.userEmail || 'Аноним'}
      </Text>
    </TouchableOpacity>
  );
}

function SubscriberCard({
  subscriber,
  colors,
  lastMessage,
  unreadCount,
  onPress,
  onDelete,
}: {
  subscriber: FirestoreSubscription;
  colors: ThemeColors;
  lastMessage: string;
  unreadCount: number;
  onPress: () => void;
  onDelete: () => void;
}) {
  const hasUnread = unreadCount > 0;
  const initial = (subscriber.subscriberName?.[0] || '?').toUpperCase();

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: hasUnread ? colors.info + '40' : colors.border,
        borderLeftWidth: hasUnread ? 3 : 1,
        borderLeftColor: hasUnread ? colors.info : colors.border,
      }}
      onPress={onPress}
      onLongPress={onDelete}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const }}>
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primary + '18',
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          marginRight: 12,
        }}>
          <Text style={{ fontSize: 18, fontWeight: '700' as const, color: colors.primary }}>
            {initial}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const }}>
            <Text style={{ fontSize: 15, fontWeight: '600' as const, color: colors.text, flex: 1 }} numberOfLines={1}>
              {subscriber.subscriberName || 'Подписчик'}
            </Text>
            <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 }}>
              {hasUnread && (
                <View style={{
                  backgroundColor: colors.info,
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                  paddingHorizontal: 6,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700' as const, color: '#fff' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={onDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.error + '15',
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                }}
              >
                <Trash2 size={14} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }} numberOfLines={1}>
            {lastMessage || 'Нет сообщений'}
          </Text>
        </View>
        <ChevronRight size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
      </View>
    </TouchableOpacity>
  );
}

function InlineChatView({
  masterId,
  subscriberId,
  partnerName,
  colors,
}: {
  masterId: string;
  subscriberId: string;
  partnerName: string;
  colors: ThemeColors;
}) {
  const {
    messages,
    loadMessages,
    unloadMessages,
    sendMessage,
    markChatAsRead,
    isLoadingMessages,
    isSending,
    userId,
  } = useChat();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledRef = useRef(false);

  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;
  const markChatAsReadRef = useRef(markChatAsRead);
  markChatAsReadRef.current = markChatAsRead;
  const unloadMessagesRef = useRef(unloadMessages);
  unloadMessagesRef.current = unloadMessages;

  useEffect(() => {
    console.log('[InlineChat] Loading messages for:', masterId, subscriberId);
    if (masterId && subscriberId) {
      loadMessagesRef.current(masterId, subscriberId);
      markChatAsReadRef.current(masterId, subscriberId);
    }
    return () => {
      console.log('[InlineChat] Unmounting, unloading messages');
      unloadMessagesRef.current();
    };
  }, [masterId, subscriberId]);

  const prevMessagesLenRef = useRef(0);

  useEffect(() => {
    if (messages.length > 0 && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } else if (messages.length > prevMessagesLenRef.current && hasScrolledRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
    prevMessagesLenRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    if (masterId && subscriberId && messages.length > 0) {
      markChatAsReadRef.current(masterId, subscriberId);
    }
  }, [messages.length, masterId, subscriberId]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const onShow = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    });
    return () => { onShow.remove(); };
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !masterId || !subscriberId) return;
    setText('');
    await sendMessage(masterId, subscriberId, trimmed);
  }, [text, masterId, subscriberId, sendMessage]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isOwn = item.senderId === userId;
      return (
        <View
          style={{
            marginVertical: 3,
            paddingHorizontal: 12,
            alignItems: isOwn ? 'flex-end' as const : 'flex-start' as const,
          }}
        >
          <View
            style={{
              maxWidth: '80%',
              borderRadius: 16,
              paddingHorizontal: 14,
              paddingVertical: 10,
              backgroundColor: isOwn ? colors.primary : colors.surfaceElevated,
              borderBottomRightRadius: isOwn ? 4 : 16,
              borderBottomLeftRadius: isOwn ? 16 : 4,
            }}
          >
            {!isOwn && (
              <Text style={{ fontSize: 12, fontWeight: '600' as const, color: colors.info, marginBottom: 3 }}>
                {item.senderName || 'Аноним'}
              </Text>
            )}
            <Text style={{ fontSize: 15, lineHeight: 20, color: isOwn ? '#FFFFFF' : colors.text }}>
              {item.text}
            </Text>
            <Text style={{ fontSize: 10, marginTop: 4, textAlign: 'right' as const, color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted }}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        </View>
      );
    },
    [userId, colors]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 100}
    >
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 10,
      }}>
        <View style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary + '18',
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        }}>
          <MessageCircle size={16} color={colors.primary} />
        </View>
        <Text style={{ fontSize: 16, fontWeight: '600' as const, color: colors.text }}>
          {partnerName}
        </Text>
      </View>

      {isLoadingMessages && messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6 }}>
          <Text style={{ fontSize: 17, fontWeight: '600' as const, color: colors.textSecondary }}>Нет сообщений</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>Начните разговор первыми!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (hasScrolledRef.current) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />
      )}

      <View style={{
        flexDirection: 'row' as const,
        alignItems: 'flex-end' as const,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.surface,
        gap: 8,
      }}>
        <TextInput
          style={{
            flex: 1,
            backgroundColor: colors.surfaceElevated,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 10,
            fontSize: 15,
            color: colors.text,
            maxHeight: 100,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          value={text}
          onChangeText={setText}
          placeholder="Сообщение..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          testID="inline-chat-input"
          onFocus={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 300);
          }}
        />
        <TouchableOpacity
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            backgroundColor: text.trim().length > 0 ? colors.primary : colors.surface,
          }}
          onPress={handleSend}
          disabled={isSending || text.trim().length === 0}
          activeOpacity={0.7}
          testID="inline-chat-send-btn"
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send size={18} color={text.trim().length > 0 ? '#fff' : colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function UpdatesPane({
  rows,
  colors,
  onItemPress,
  onMarkAllSeen,
  hasLoaded,
}: {
  rows: Array<{ id: string; type: 'object' | 'work_entry' | 'inventory' | 'knowledge' | 'task' | 'file'; title: string; subtitle?: string; timestamp: number }>;
  colors: ThemeColors;
  onItemPress: (row: any) => void;
  onMarkAllSeen: () => void;
  hasLoaded: boolean;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderIcon = useCallback((type: string) => {
    const size = 18;
    switch (type) {
      case 'object': return <Building2 size={size} color={colors.primary} />;
      case 'work_entry': return <Wrench size={size} color={colors.warning} />;
      case 'inventory': return <Package size={size} color={colors.success} />;
      case 'knowledge': return <BookOpen size={size} color={colors.info} />;
      case 'task': return <ClipboardList size={size} color={colors.warning} />;
      case 'file': return <Paperclip size={size} color={colors.info} />;
      default: return <Bell size={size} color={colors.textMuted} />;
    }
  }, [colors]);

  const labelFor = (type: string): string => {
    switch (type) {
      case 'object': return 'Объект';
      case 'work_entry': return 'Запись работ';
      case 'inventory': return 'Склад';
      case 'knowledge': return 'База знаний';
      case 'task': return 'Задача';
      case 'file': return 'Файл';
      default: return 'Обновление';
    }
  };

  if (!hasLoaded) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Sparkles size={48} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Нет обновлений</Text>
        <Text style={styles.emptySubtext}>После синхронизации здесь появятся изменения от мастера</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.headerActions}>
        <Text style={styles.countText}>
          {rows.length} новых
        </Text>
        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={onMarkAllSeen}
          activeOpacity={0.7}
        >
          <Check size={14} color={colors.primary} />
          <Text style={styles.markAllText}>Отметить всё</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={{
              backgroundColor: colors.surfaceElevated,
              borderRadius: 14,
              padding: 14,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: colors.border,
              borderLeftWidth: 3,
              borderLeftColor: colors.warning,
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              gap: 12,
            }}
            onPress={() => onItemPress(item)}
            activeOpacity={0.7}
          >
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const }}>
              {renderIcon(item.type)}
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: '700' as const, color: colors.warning, textTransform: 'uppercase' as const, letterSpacing: 0.4 }}>
                  {labelFor(item.type)}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, flex: 1 }} numberOfLines={1}>
                  {formatDate(item.timestamp)}
                </Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600' as const, color: colors.text }} numberOfLines={2}>
                {item.title}
              </Text>
              {item.subtitle ? (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              ) : null}
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </>
  );
}

export default function NotificationsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { unreadComments, markAsRead, markAllAsRead, unreadCount: commentUnreadCount } = useComments();
  const { chats, unreadMessagesCount, userId: chatUserId, deleteChat, isDeleting } = useChat();
  const { getWorkEntry } = useObjects();
  const { subscriptions, firestoreSubscribers, removeFirestoreSubscriber } = useBackup();
  const { isSubscriberProfile, activeProfileId } = useProfile();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'comments' | 'chats' | 'updates'>('comments');
  const { objects, workEntries, documents } = useObjects();
  const { items: inventoryItems } = useInventory();
  const { items: knowledgeItems } = useKnowledge();
  const { tasks } = useTasks();

  const updatesSeenKey = useMemo(() => `@updates_seen_${activeProfileId}`, [activeProfileId]);
  const updatesDismissedKey = useMemo(() => `@updates_dismissed_${activeProfileId}`, [activeProfileId]);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [hasLoadedSeen, setHasLoadedSeen] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(updatesSeenKey);
        if (!cancelled) {
          setLastSeen(v ? parseInt(v, 10) || 0 : 0);
        }
      } catch {}
      try {
        const d = await AsyncStorage.getItem(updatesDismissedKey);
        if (!cancelled) {
          const arr: string[] = d ? JSON.parse(d) : [];
          setDismissedIds(new Set(arr));
        }
      } catch {}
      if (!cancelled) setHasLoadedSeen(true);
    })();
    return () => { cancelled = true; };
  }, [updatesSeenKey, updatesDismissedKey]);

  type UpdateRow = {
    id: string;
    type: 'object' | 'work_entry' | 'inventory' | 'knowledge' | 'task' | 'file';
    title: string;
    subtitle?: string;
    timestamp: number;
    objectId?: string;
    entityId?: string;
    fileKind?: 'document' | 'photo' | 'pdf' | 'knowledge';
  };

  const updateRows: UpdateRow[] = useMemo(() => {
    const rows: UpdateRow[] = [];
    objects.forEach(o => {
      const ts = o.updatedAt || o.createdAt;
      if (ts > lastSeen) rows.push({ id: 'obj_' + o.id, type: 'object', title: o.name, subtitle: o.address || undefined, timestamp: ts, objectId: o.id });
    });
    Object.values(workEntries).forEach(arr => {
      arr.forEach(e => {
        if (e.createdAt > lastSeen) {
          const objName = objects.find(o => o.id === e.objectId)?.name;
          rows.push({ id: 'we_' + e.id, type: 'work_entry', title: e.description.slice(0, 80) || 'Запись работ', subtitle: objName, timestamp: e.createdAt, objectId: e.objectId, entityId: e.id });
          (e.photos || []).forEach((p, idx) => {
            if (e.createdAt > lastSeen) {
              rows.push({ id: 'wep_' + e.id + '_' + idx, type: 'file', title: 'Фото к записи работ', subtitle: objName, timestamp: e.createdAt, objectId: e.objectId, entityId: e.id, fileKind: 'photo' });
            }
          });
          if (e.attachedPdfId) {
            rows.push({ id: 'wepdf_' + e.id, type: 'file', title: 'PDF к записи работ', subtitle: objName, timestamp: e.createdAt, objectId: e.objectId, entityId: e.id, fileKind: 'pdf' });
          }
        }
      });
    });
    Object.values(documents).forEach(arr => {
      arr.forEach(d => {
        if (d.uploadedAt > lastSeen) {
          const objName = objects.find(o => o.id === d.objectId)?.name;
          rows.push({ id: 'doc_' + d.id, type: 'file', title: d.name, subtitle: objName, timestamp: d.uploadedAt, objectId: d.objectId, entityId: d.id, fileKind: 'document' });
        }
      });
    });
    inventoryItems.forEach(i => {
      const ts = i.updatedAt || i.createdAt;
      if (ts > lastSeen) rows.push({ id: 'inv_' + i.id, type: 'inventory', title: i.name, subtitle: `${i.quantity} ${i.unit}`, timestamp: ts });
    });
    knowledgeItems.forEach(k => {
      if (k.createdAt > lastSeen) {
        rows.push({ id: 'kn_' + k.id, type: 'knowledge', title: k.title, subtitle: k.category, timestamp: k.createdAt });
        if (k.filePath || k.fileUrl) {
          rows.push({ id: 'knf_' + k.id, type: 'file', title: k.title, subtitle: k.category || 'База знаний', timestamp: k.createdAt, entityId: k.id, fileKind: 'knowledge' });
        }
      }
    });
    tasks.forEach(t => {
      if (t.createdAt > lastSeen) rows.push({ id: 'tk_' + t.id, type: 'task', title: t.title, subtitle: t.objectName, timestamp: t.createdAt, entityId: t.id });
    });
    rows.sort((a, b) => b.timestamp - a.timestamp);
    return rows.filter(r => !dismissedIds.has(r.id));
  }, [objects, workEntries, documents, inventoryItems, knowledgeItems, tasks, lastSeen, dismissedIds]);

  const updatesCount = updateRows.length;

  const markUpdatesSeen = useCallback(async () => {
    const now = Date.now();
    setLastSeen(now);
    setDismissedIds(new Set());
    try { await AsyncStorage.setItem(updatesSeenKey, String(now)); } catch {}
    try { await AsyncStorage.removeItem(updatesDismissedKey); } catch {}
  }, [updatesSeenKey, updatesDismissedKey]);

  const dismissUpdate = useCallback(async (id: string) => {
    setDismissedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      AsyncStorage.setItem(updatesDismissedKey, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, [updatesDismissedKey]);

  const navigateToUpdate = useCallback((row: UpdateRow) => {
    dismissUpdate(row.id);
    switch (row.type) {
      case 'object':
      case 'work_entry':
        if (row.objectId) router.push({ pathname: '/(home)/object-detail' as any, params: { id: row.objectId } });
        break;
      case 'inventory':
        router.navigate('/(tabs)/inventory' as any);
        break;
      case 'knowledge':
        router.navigate('/(tabs)/knowledge' as any);
        break;
      case 'task':
        router.navigate('/(tabs)/reminders' as any);
        break;
      case 'file':
        if (row.fileKind === 'knowledge') {
          router.navigate('/(tabs)/knowledge' as any);
        } else if (row.objectId) {
          router.push({ pathname: '/(home)/object-detail' as any, params: { id: row.objectId } });
        }
        break;
    }
  }, [router, dismissUpdate]);

  const currentUserId = chatUserId;

  const activeSubscription = useMemo(() => {
    if (isSubscriberProfile) {
      return subscriptions.find(s => s.id === activeProfileId) || null;
    }
    return null;
  }, [isSubscriberProfile, activeProfileId, subscriptions]);

  const subscriberChatInfo = useMemo(() => {
    const info = new Map<string, { lastMessage: string; unreadCount: number }>();
    if (!currentUserId) return info;
    chats.forEach(chat => {
      const iAmMaster = chat.masterId === currentUserId;
      info.set(chat.subscriberId, {
        lastMessage: chat.lastMessage || '',
        unreadCount: iAmMaster ? (chat.unreadForMaster || 0) : (chat.unreadForSubscriber || 0),
      });
    });
    return info;
  }, [chats, currentUserId]);

  const handleOpenSubscriberChat = useCallback((subscriber: FirestoreSubscription) => {
    if (!currentUserId) {
      Alert.alert('Ошибка', 'Авторизация не завершена');
      return;
    }
    router.push({
      pathname: '/chat' as any,
      params: {
        masterId: currentUserId,
        subscriberId: subscriber.subscriberId,
        partnerName: subscriber.subscriberName || 'Подписчик',
      },
    });
  }, [currentUserId, router]);

  const handleDeleteSubscriberChat = useCallback((subscriber: FirestoreSubscription) => {
    const name = subscriber.subscriberName || 'Подписчик';
    Alert.alert(
      'Удалить чат',
      `Удалить чат с ${name}? Все сообщения будут удалены.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            if (currentUserId) {
              deleteChat(currentUserId, subscriber.subscriberId);
            }
          },
        },
      ]
    );
  }, [currentUserId, deleteChat]);

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

  const renderCommentItem = useCallback(({ item }: { item: Comment }) => (
    <UnreadCommentCard
      comment={item}
      colors={colors}
      onPress={() => navigateToComment(item)}
    />
  ), [colors, navigateToComment]);

  const renderSubscriberItem = useCallback(({ item }: { item: FirestoreSubscription }) => {
    const chatInfo = subscriberChatInfo.get(item.subscriberId);
    return (
      <SubscriberCard
        subscriber={item}
        colors={colors}
        lastMessage={chatInfo?.lastMessage || ''}
        unreadCount={chatInfo?.unreadCount || 0}
        onPress={() => handleOpenSubscriberChat(item)}
        onDelete={() => handleDeleteSubscriberChat(item)}
      />
    );
  }, [colors, subscriberChatInfo, handleOpenSubscriberChat, handleDeleteSubscriberChat]);

  const commentKeyExtractor = useCallback((item: Comment) => item.id, []);
  const subscriberKeyExtractor = useCallback((item: FirestoreSubscription) => item.id, []);

  const subscriberMasterId = activeSubscription?.masterId || '';
  const subscriberPartnerName = activeSubscription?.name || 'Мастер';

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'comments' && styles.tabActive]}
          onPress={() => setActiveTab('comments')}
          activeOpacity={0.7}
        >
          <MessageSquare size={16} color={activeTab === 'comments' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'comments' && styles.tabTextActive]}>
            Коммент.
          </Text>
          {commentUnreadCount > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.tabBadgeText}>
                {commentUnreadCount > 99 ? '99+' : commentUnreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chats' && styles.tabActive]}
          onPress={() => setActiveTab('chats')}
          activeOpacity={0.7}
        >
          <MessageCircle size={16} color={activeTab === 'chats' ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === 'chats' && styles.tabTextActive]}>
            Чаты
          </Text>
          {unreadMessagesCount > 0 && (
            <View style={[styles.tabBadge, { backgroundColor: colors.info }]}>
              <Text style={styles.tabBadgeText}>
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        {isSubscriberProfile && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'updates' && styles.tabActive]}
            onPress={() => setActiveTab('updates')}
            activeOpacity={0.7}
          >
            <Sparkles size={16} color={activeTab === 'updates' ? colors.primary : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'updates' && styles.tabTextActive]}>
              Обновл.
            </Text>
            {updatesCount > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.tabBadgeText}>
                  {updatesCount > 99 ? '99+' : updatesCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'updates' && isSubscriberProfile ? (
        <UpdatesPane
          rows={updateRows}
          colors={colors}
          onItemPress={navigateToUpdate}
          onMarkAllSeen={markUpdatesSeen}
          hasLoaded={hasLoadedSeen}
        />
      ) : activeTab === 'comments' ? (
        <>
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
              <MessageSquare size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Нет комментариев</Text>
              <Text style={styles.emptySubtext}>
                Новые комментарии будут отображаться здесь
              </Text>
            </View>
          ) : (
            <FlatList
              data={unreadComments}
              renderItem={renderCommentItem}
              keyExtractor={commentKeyExtractor}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : isSubscriberProfile ? (
        currentUserId && subscriberMasterId ? (
          <InlineChatView
            masterId={subscriberMasterId}
            subscriberId={currentUserId}
            partnerName={subscriberPartnerName}
            colors={colors}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <MessageCircle size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>Чат недоступен</Text>
            <Text style={styles.emptySubtext}>
              Проверьте подписку на мастера
            </Text>
          </View>
        )
      ) : (
        <>
          {firestoreSubscribers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Users size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Нет подписчиков</Text>
              <Text style={styles.emptySubtext}>
                Когда подписчики присоединятся, они появятся здесь
              </Text>
            </View>
          ) : (
            <FlatList
              data={firestoreSubscribers}
              renderItem={renderSubscriberItem}
              keyExtractor={subscriberKeyExtractor}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
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
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 8,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '600' as const,
    },
    tabBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      marginLeft: 2,
    },
    tabBadgeText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: '#fff',
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
      fontWeight: '600' as const,
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
      fontWeight: '600' as const,
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
      fontWeight: '600' as const,
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
