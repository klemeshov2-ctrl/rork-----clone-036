import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { auth, firestore } from '@/config/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { useBackup } from './BackupProvider';
import { useProfile } from './ProfileProvider';
import { useComments } from './CommentsProvider';
import type { ChatMessage, ChatDialog } from '@/types';
import * as Notifications from 'expo-notifications';

const DISPLAY_NAME_KEY = '@user_display_name';
const READ_MESSAGE_IDS_KEY = '@read_message_ids';

interface ChatContextType {
  chats: ChatDialog[];
  messages: ChatMessage[];
  loadMessages: (masterId: string, subscriberId: string) => void;
  sendMessage: (masterId: string, subscriberId: string, text: string) => Promise<void>;
  markChatAsRead: (masterId: string, subscriberId: string) => void;
  unreadMessagesCount: number;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  userId: string | null;
}

function getChatDocId(masterId: string, subscriberId: string): string {
  return `${masterId}_${subscriberId}`;
}

export const [ChatProvider, useChat] = createContextHook<ChatContextType>(() => {
  const { userEmail, masterId: backupMasterId, subscriptions, firestoreUid } = useBackup();
  const { activeProfileId, isSubscriberProfile } = useProfile();
  const { userId: commentsUserId, displayName } = useComments();

  const [userId, setUserId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatDialog[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const messagesUnsubRef = useRef<(() => void) | null>(null);
  const chatsUnsubRef = useRef<(() => void) | null>(null);
  const globalMsgUnsubRef = useRef<(() => void) | null>(null);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const prevGlobalMsgIdsRef = useRef<Set<string>>(new Set());
  const activeLoadedChatRef = useRef<string | null>(null);

  useEffect(() => {
    setUserId(commentsUserId);
  }, [commentsUserId]);

  useEffect(() => {
    AsyncStorage.getItem(READ_MESSAGE_IDS_KEY).then(stored => {
      if (stored) {
        try {
          const ids = JSON.parse(stored) as string[];
          setReadMessageIds(new Set(ids));
        } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  const persistReadIds = useCallback((ids: Set<string>) => {
    const arr = Array.from(ids);
    AsyncStorage.setItem(READ_MESSAGE_IDS_KEY, JSON.stringify(arr)).catch(() => {});
  }, []);

  const activeMasterId = useMemo(() => {
    if (!isSubscriberProfile) {
      return backupMasterId || userId;
    }
    const activeSub = subscriptions.find(s => s.id === activeProfileId);
    if (activeSub?.masterId) {
      return activeSub.masterId;
    }
    return backupMasterId || userId;
  }, [isSubscriberProfile, activeProfileId, subscriptions, backupMasterId, userId]);

  const relevantMasterIds = useMemo(() => {
    const ids = new Set<string>();
    if (backupMasterId) ids.add(backupMasterId);
    if (userId) ids.add(userId);
    if (firestoreUid && firestoreUid !== userId) ids.add(firestoreUid);
    subscriptions.forEach(s => {
      if (s.masterId) ids.add(s.masterId);
    });
    return Array.from(ids).filter(Boolean);
  }, [backupMasterId, userId, firestoreUid, subscriptions]);

  useEffect(() => {
    if (!userId) return;
    console.log('[Chat] Setting up global messages listener for notifications');

    if (globalMsgUnsubRef.current) {
      globalMsgUnsubRef.current();
      globalMsgUnsubRef.current = null;
    }

    try {
      const q = query(
        collection(firestore, 'messages'),
        where('masterId', 'in', relevantMasterIds.length > 0 ? relevantMasterIds.slice(0, 30) : [userId]),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const newIds = new Set<string>();
          const freshMessages: Array<{ id: string; senderId: string; senderName: string; text: string; masterId: string; subscriberId: string }> = [];

          snapshot.docs.forEach((d) => {
            const data = d.data();
            newIds.add(d.id);
            if (
              !prevGlobalMsgIdsRef.current.has(d.id) &&
              typeof data.senderId === 'string' &&
              data.senderId !== userId
            ) {
              const chatKey = `${data.masterId}_${data.subscriberId}`;
              if (activeLoadedChatRef.current !== chatKey) {
                freshMessages.push({
                  id: d.id,
                  senderId: data.senderId as string,
                  senderName: typeof data.senderName === 'string' ? data.senderName : 'Сообщение',
                  text: typeof data.text === 'string' ? data.text : '',
                  masterId: typeof data.masterId === 'string' ? data.masterId : '',
                  subscriberId: typeof data.subscriberId === 'string' ? data.subscriberId : '',
                });
              }
            }
          });

          if (prevGlobalMsgIdsRef.current.size > 0 && freshMessages.length > 0 && Platform.OS !== 'web') {
            for (const m of freshMessages.slice(0, 3)) {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: `${m.senderName}`,
                  body: m.text.substring(0, 100),
                  data: { type: 'chat', masterId: m.masterId, subscriberId: m.subscriberId },
                },
                trigger: null,
              }).catch((err) => {
                console.log('[Chat] Global notification error:', err);
              });
            }
          }

          prevGlobalMsgIdsRef.current = newIds;
        },
        (error) => {
          console.log('[Chat] Global messages listener error:', error?.message);
        }
      );

      globalMsgUnsubRef.current = unsubscribe;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Chat] Global messages listener setup error:', msg);
    }

    return () => {
      if (globalMsgUnsubRef.current) {
        globalMsgUnsubRef.current();
        globalMsgUnsubRef.current = null;
      }
    };
  }, [userId, relevantMasterIds]);

  useEffect(() => {
    if (!userId) return;
    console.log('[Chat] Setting up chats subscription, userId:', userId);
    setIsLoadingChats(true);

    if (chatsUnsubRef.current) {
      chatsUnsubRef.current();
      chatsUnsubRef.current = null;
    }

    const isMaster = !isSubscriberProfile;

    try {
      const q = query(
        collection(firestore, 'chats'),
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTime', 'desc'),
        limit(100)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs: ChatDialog[] = [];
          snapshot.docs.forEach((d) => {
            const data = d.data();
            const lastMessageTime = data.lastMessageTime instanceof Timestamp
              ? data.lastMessageTime.toMillis()
              : (typeof data.lastMessageTime === 'number' ? data.lastMessageTime : Date.now());
            docs.push({
              id: d.id,
              masterId: typeof data.masterId === 'string' ? data.masterId : '',
              subscriberId: typeof data.subscriberId === 'string' ? data.subscriberId : '',
              masterName: typeof data.masterName === 'string' ? data.masterName : 'Мастер',
              subscriberName: typeof data.subscriberName === 'string' ? data.subscriberName : 'Подписчик',
              lastMessage: typeof data.lastMessage === 'string' ? data.lastMessage : '',
              lastMessageTime,
              unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
            });
          });
          console.log('[Chat] Chats snapshot received:', docs.length);
          setChats(docs);
          setIsLoadingChats(false);
        },
        (error) => {
          console.log('[Chat] Chats subscription error:', error?.message);
          setIsLoadingChats(false);
        }
      );

      chatsUnsubRef.current = unsubscribe;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Chat] Chats subscription setup error:', msg);
      setIsLoadingChats(false);
    }

    return () => {
      if (chatsUnsubRef.current) {
        chatsUnsubRef.current();
        chatsUnsubRef.current = null;
      }
    };
  }, [userId, isSubscriberProfile, relevantMasterIds]);

  const unreadMessagesCount = useMemo(() => {
    if (!userId) return 0;
    let count = 0;
    chats.forEach(chat => {
      const isMasterUser = chat.masterId === userId || relevantMasterIds.includes(chat.masterId);
      const isSubscriberUser = chat.subscriberId === userId;
      if (isMasterUser || isSubscriberUser) {
        count += chat.unreadCount || 0;
      }
    });
    return count;
  }, [chats, userId, relevantMasterIds]);

  const loadMessages = useCallback((masterId: string, subscriberId: string) => {
    console.log('[Chat] Loading messages for master:', masterId, 'subscriber:', subscriberId);
    activeLoadedChatRef.current = `${masterId}_${subscriberId}`;

    if (messagesUnsubRef.current) {
      messagesUnsubRef.current();
      messagesUnsubRef.current = null;
    }

    setIsLoadingMessages(true);
    setMessages([]);

    try {
      const q = query(
        collection(firestore, 'messages'),
        where('masterId', '==', masterId),
        where('subscriberId', '==', subscriberId),
        orderBy('createdAt', 'asc'),
        limit(500)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs: ChatMessage[] = [];
          snapshot.docs.forEach((d) => {
            const data = d.data();
            const createdAt = data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());
            docs.push({
              id: d.id,
              masterId: typeof data.masterId === 'string' ? data.masterId : '',
              subscriberId: typeof data.subscriberId === 'string' ? data.subscriberId : '',
              text: typeof data.text === 'string' ? data.text : '',
              senderId: typeof data.senderId === 'string' ? data.senderId : '',
              senderName: typeof data.senderName === 'string' ? data.senderName : '',
              createdAt,
              isRead: typeof data.isRead === 'boolean' ? data.isRead : false,
            });
          });

          prevMessageIdsRef.current = new Set(docs.map(d => d.id));
          console.log('[Chat] Messages snapshot received:', docs.length);
          setMessages(docs);
          setIsLoadingMessages(false);
        },
        (error) => {
          console.log('[Chat] Messages subscription error:', error?.message);
          setIsLoadingMessages(false);
        }
      );

      messagesUnsubRef.current = unsubscribe;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Chat] loadMessages error:', msg);
      setIsLoadingMessages(false);
    }
  }, [userId]);

  const sendMessage = useCallback(async (masterId: string, subscriberId: string, text: string) => {
    if (!userId) {
      Alert.alert('Ошибка', 'Авторизация не завершена.');
      return;
    }

    setIsSending(true);
    try {
      const resolvedName = displayName || userEmail || 'Аноним';
      const isMaster = !isSubscriberProfile;

      console.log('[Chat] Sending message:', { masterId, subscriberId, senderId: userId, senderName: resolvedName });

      try {
        await addDoc(collection(firestore, 'messages'), {
          masterId,
          subscriberId,
          text,
          senderId: userId,
          senderName: resolvedName,
          createdAt: serverTimestamp(),
          isRead: false,
        });
      } catch (msgErr: unknown) {
        const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
        console.log('[Chat] Failed to add message doc:', errMsg);
        if (errMsg.includes('permission') || errMsg.includes('Permission')) {
          Alert.alert('Ошибка доступа', 'Нет прав для отправки сообщений. Попросите мастера настроить правила Firebase (Firestore Rules) для коллекций messages и chats.');
          return;
        }
        throw msgErr;
      }

      try {
        const chatDocId = getChatDocId(masterId, subscriberId);
        const chatRef = doc(firestore, 'chats', chatDocId);
        const chatSnap = await getDoc(chatRef);

        const activeSub = subscriptions.find(s => s.masterId === masterId);

        if (chatSnap.exists()) {
          const updateData: Record<string, unknown> = {
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            unreadCount: (chatSnap.data().unreadCount || 0) + 1,
            ...(isMaster ? { masterName: resolvedName } : { subscriberName: resolvedName }),
          };
          if (!chatSnap.data().participants) {
            updateData.participants = [masterId, subscriberId];
          }
          await updateDoc(chatRef, updateData);
        } else {
          await setDoc(chatRef, {
            masterId,
            subscriberId,
            participants: [masterId, subscriberId],
            masterName: isMaster ? resolvedName : (activeSub?.name || 'Мастер'),
            subscriberName: isMaster ? (activeSub?.name || 'Подписчик') : resolvedName,
            lastMessage: text,
            lastMessageTime: serverTimestamp(),
            unreadCount: 1,
          });
        }
      } catch (chatErr: unknown) {
        const errMsg = chatErr instanceof Error ? chatErr.message : String(chatErr);
        console.log('[Chat] Failed to update chat doc (non-critical):', errMsg);
      }

      console.log('[Chat] Message sent successfully');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Chat] sendMessage error:', msg);
      Alert.alert('Ошибка', msg || 'Не удалось отправить сообщение');
    } finally {
      setIsSending(false);
    }
  }, [userId, userEmail, displayName, isSubscriberProfile, subscriptions]);

  const markChatAsRead = useCallback((masterId: string, subscriberId: string) => {
    if (!userId) return;
    const chatDocId = getChatDocId(masterId, subscriberId);
    const chatRef = doc(firestore, 'chats', chatDocId);

    updateDoc(chatRef, { unreadCount: 0 }).catch((err) => {
      console.log('[Chat] markChatAsRead error:', err?.message);
    });

    const batch = writeBatch(firestore);
    const q = query(
      collection(firestore, 'messages'),
      where('masterId', '==', masterId),
      where('subscriberId', '==', subscriberId),
      where('isRead', '==', false)
    );
    getDocs(q).then((snapshot) => {
      snapshot.docs.forEach((d) => {
        if (d.data().senderId !== userId) {
          batch.update(d.ref, { isRead: true });
        }
      });
      return batch.commit();
    }).catch((err) => {
      console.log('[Chat] markChatAsRead batch error:', err?.message);
    });
  }, [userId]);

  useEffect(() => {
    return () => {
      if (messagesUnsubRef.current) {
        messagesUnsubRef.current();
        messagesUnsubRef.current = null;
      }
      activeLoadedChatRef.current = null;
    };
  }, []);

  return useMemo(() => ({
    chats,
    messages,
    loadMessages,
    sendMessage,
    markChatAsRead,
    unreadMessagesCount,
    isLoadingChats,
    isLoadingMessages,
    isSending,
    userId,
  }), [chats, messages, loadMessages, sendMessage, markChatAsRead, unreadMessagesCount, isLoadingChats, isLoadingMessages, isSending, userId]);
});
