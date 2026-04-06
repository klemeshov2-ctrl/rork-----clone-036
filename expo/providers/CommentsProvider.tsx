import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { auth, firestore } from '@/config/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  orderBy,
  limit,
} from 'firebase/firestore';
import { useBackup } from './BackupProvider';
import type { Comment, CommentEntityType } from '@/types';
import * as Notifications from 'expo-notifications';

const DISPLAY_NAME_KEY = '@user_display_name';
const READ_COMMENT_IDS_KEY = '@read_comment_ids';

interface CommentsContextType {
  comments: Record<string, Comment[]>;
  loadComments: (entityType: CommentEntityType, entityId: string) => void;
  addComment: (entityType: CommentEntityType, entityId: string, text: string) => Promise<void>;
  isLoading: boolean;
  isSending: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  displayName: string;
  setDisplayName: (name: string) => Promise<void>;
  unreadComments: Comment[];
  unreadCount: number;
  markAsRead: (commentId: string) => void;
  markAllAsRead: () => void;
}

function makeKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export const [CommentsProvider, useComments] = createContextHook<CommentsContextType>(() => {
  const { userEmail, masterId: backupMasterId } = useBackup();

  const [userId, setUserId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [displayName, setDisplayNameState] = useState<string>('');
  const unsubscribeMap = useRef<Record<string, () => void>>({});

  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [readCommentIds, setReadCommentIds] = useState<Set<string>>(new Set());
  const prevCommentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(DISPLAY_NAME_KEY).then(stored => {
      if (stored) setDisplayNameState(stored);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(READ_COMMENT_IDS_KEY).then(stored => {
      if (stored) {
        try {
          const ids = JSON.parse(stored) as string[];
          setReadCommentIds(new Set(ids));
        } catch { /* ignore */ }
      }
    }).catch(() => {});
  }, []);

  const persistReadIds = useCallback((ids: Set<string>) => {
    const arr = Array.from(ids);
    AsyncStorage.setItem(READ_COMMENT_IDS_KEY, JSON.stringify(arr)).catch(() => {});
  }, []);

  const setDisplayName = useCallback(async (name: string) => {
    setDisplayNameState(name);
    try {
      await AsyncStorage.setItem(DISPLAY_NAME_KEY, name);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    console.log('[Comments] Initializing Firebase anonymous auth...');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('[Comments] Firebase user authenticated:', user.uid);
        setUserId(user.uid);
      } else {
        console.log('[Comments] No Firebase user, signing in anonymously...');
        signInAnonymously(auth).catch((err) => {
          console.log('[Comments] Anonymous auth error:', err?.message);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    console.log('[Comments] Setting up global comments subscription...');
    try {
      const q = query(
        collection(firestore, 'comments'),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs: Comment[] = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            const createdAt = data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());
            const entityType = (typeof data.entityType === 'string' ? data.entityType : '') as CommentEntityType;
            docs.push({
              id: doc.id,
              entityType,
              entityId: typeof data.entityId === 'string' ? data.entityId : '',
              userId: typeof data.userId === 'string' ? data.userId : '',
              userEmail: typeof data.userEmail === 'string' ? data.userEmail : '',
              userName: typeof data.userName === 'string' ? data.userName : '',
              text: typeof data.text === 'string' ? data.text : '',
              createdAt,
              masterId: typeof data.masterId === 'string' ? data.masterId : undefined,
            });
          });

          const newIds = new Set(docs.map(d => d.id));
          const prevIds = prevCommentIdsRef.current;
          const currentMasterId = backupMasterId || userId;
          const freshComments = docs.filter(d =>
            !prevIds.has(d.id) && d.userId !== userId && d.masterId !== currentMasterId
          );

          if (prevIds.size > 0 && freshComments.length > 0 && Platform.OS !== 'web') {
            for (const c of freshComments.slice(0, 3)) {
              const entityLabel = c.entityType === 'work_entry' ? 'Запись работ'
                : c.entityType === 'inventory' ? 'Склад'
                : c.entityType === 'task' ? 'Задача' : 'Комментарий';
              Notifications.scheduleNotificationAsync({
                content: {
                  title: `Новый комментарий — ${entityLabel}`,
                  body: c.text.substring(0, 100),
                  data: { commentId: c.id, entityType: c.entityType, entityId: c.entityId },
                },
                trigger: null,
              }).catch((err) => {
                console.log('[Comments] Notification error:', err);
              });
            }
          }

          prevCommentIdsRef.current = newIds;
          setAllComments(docs);
          console.log('[Comments] Global subscription: received', docs.length, 'comments');
        },
        (error) => {
          console.log('[Comments] Global subscription error:', error?.message);
        }
      );
      return () => unsubscribe();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Comments] Global subscription setup error:', msg);
    }
  }, [userId, backupMasterId]);

  const unreadComments = useMemo(() => {
    const currentMasterId = backupMasterId || userId;
    return allComments
      .filter(c => !readCommentIds.has(c.id) && c.userId !== userId && c.masterId !== currentMasterId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [allComments, readCommentIds, userId, backupMasterId]);

  const unreadCount = unreadComments.length;

  useEffect(() => {
    if (Platform.OS !== 'web' && unreadCount > 0) {
      Notifications.setBadgeCountAsync(unreadCount).catch(() => {});
    } else if (Platform.OS !== 'web') {
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }
  }, [unreadCount]);

  const markAsRead = useCallback((commentId: string) => {
    setReadCommentIds(prev => {
      const next = new Set(prev);
      next.add(commentId);
      persistReadIds(next);
      return next;
    });
  }, [persistReadIds]);

  const markAllAsRead = useCallback(() => {
    setReadCommentIds(prev => {
      const next = new Set(prev);
      allComments.forEach(c => next.add(c.id));
      persistReadIds(next);
      return next;
    });
  }, [allComments, persistReadIds]);

  const parseSnapshot = useCallback((snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => {
    const docs: Comment[] = [];
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt instanceof Timestamp
        ? data.createdAt.toMillis()
        : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());

      const entityType = (typeof data.entityType === 'string' ? data.entityType : '') as CommentEntityType;

      docs.push({
        id: doc.id,
        entityType,
        entityId: typeof data.entityId === 'string' ? data.entityId : '',
        userId: typeof data.userId === 'string' ? data.userId : '',
        userEmail: typeof data.userEmail === 'string' ? data.userEmail : '',
        userName: typeof data.userName === 'string' ? data.userName : '',
        text: typeof data.text === 'string' ? data.text : '',
        createdAt: createdAt as number,
        masterId: typeof data.masterId === 'string' ? data.masterId : undefined,
      });
    });
    docs.sort((a, b) => a.createdAt - b.createdAt);
    return docs;
  }, []);

  const loadComments = useCallback((entityType: CommentEntityType, entityId: string) => {
    const key = makeKey(entityType, entityId);
    console.log('[Comments] Subscribing to comments for', key);

    if (unsubscribeMap.current[key]) {
      unsubscribeMap.current[key]();
      delete unsubscribeMap.current[key];
    }

    setIsLoading(true);

    try {
      const q = query(
        collection(firestore, 'comments'),
        where('entityType', '==', String(entityType)),
        where('entityId', '==', String(entityId))
      );

      console.log('[Comments] Trying onSnapshot for', key);

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = parseSnapshot(snapshot as unknown as { docs: Array<{ id: string; data: () => Record<string, unknown> }> });
          console.log('[Comments] onSnapshot received', docs.length, 'comments for', key);
          setCommentsMap((prev) => ({ ...prev, [key]: docs }));
          setIsLoading(false);
        },
        async (error) => {
          console.log('[Comments] onSnapshot error for', key, ':', error?.message);
          console.log('[Comments] Falling back to getDocs for', key);
          try {
            const snapshot = await getDocs(q);
            const docs = parseSnapshot(snapshot as unknown as { docs: Array<{ id: string; data: () => Record<string, unknown> }> });
            console.log('[Comments] getDocs received', docs.length, 'comments for', key);
            setCommentsMap((prev) => ({ ...prev, [key]: docs }));
          } catch (fallbackErr: unknown) {
            const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            console.log('[Comments] getDocs fallback error:', fbMsg);
          }
          setIsLoading(false);
        }
      );

      unsubscribeMap.current[key] = unsubscribe;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Comments] loadComments error:', msg);
      setIsLoading(false);
    }
  }, [parseSnapshot]);

  useEffect(() => {
    return () => {
      Object.values(unsubscribeMap.current).forEach((unsub) => unsub());
      unsubscribeMap.current = {};
    };
  }, []);

  const _effectiveMasterId = backupMasterId || userId;

  const addComment = useCallback(async (entityType: CommentEntityType, entityId: string, text: string) => {
    if (!userId) {
      Alert.alert('Ошибка', 'Авторизация не завершена. Попробуйте позже.');
      return;
    }

    setIsSending(true);
    try {
      const resolvedName = displayName || userEmail || 'Аноним';
      const resolvedMasterId = backupMasterId || userId;
      console.log('[Comments] Adding comment:', { entityType, entityId, userId, masterId: resolvedMasterId, userName: resolvedName });

      await addDoc(collection(firestore, 'comments'), {
        entityType: String(entityType),
        entityId: String(entityId),
        userId,
        masterId: resolvedMasterId,
        userEmail: userEmail || '',
        userName: resolvedName,
        text,
        createdAt: serverTimestamp(),
      });

      console.log('[Comments] Comment added successfully');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('[Comments] addComment error:', msg);
      Alert.alert('Ошибка', msg || 'Не удалось добавить комментарий');
    } finally {
      setIsSending(false);
    }
  }, [userId, userEmail, displayName, backupMasterId]);

  return useMemo(() => ({
    comments: commentsMap,
    loadComments,
    addComment,
    isLoading,
    isSending,
    isAuthenticated: !!userId,
    userId,
    displayName,
    setDisplayName,
    unreadComments,
    unreadCount,
    markAsRead,
    markAllAsRead,
  }), [commentsMap, loadComments, addComment, isLoading, isSending, userId, displayName, setDisplayName, unreadComments, unreadCount, markAsRead, markAllAsRead]);
});
