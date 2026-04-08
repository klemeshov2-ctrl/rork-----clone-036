import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';
import { useChat } from '@/providers/ChatProvider';
import type { ChatMessage } from '@/types';

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

function MessageBubble({
  message,
  isOwn,
  colors,
}: {
  message: ChatMessage;
  isOwn: boolean;
  colors: ThemeColors;
}) {
  return (
    <View
      style={[
        bubbleStyles.wrapper,
        isOwn ? bubbleStyles.wrapperOwn : bubbleStyles.wrapperOther,
      ]}
    >
      <View
        style={[
          bubbleStyles.bubble,
          {
            backgroundColor: isOwn ? colors.primary : colors.surfaceElevated,
            borderBottomRightRadius: isOwn ? 4 : 16,
            borderBottomLeftRadius: isOwn ? 16 : 4,
          },
        ]}
      >
        {!isOwn && (
          <Text style={[bubbleStyles.senderName, { color: colors.info }]}>
            {message.senderName || 'Аноним'}
          </Text>
        )}
        <Text
          style={[
            bubbleStyles.text,
            { color: isOwn ? '#FFFFFF' : colors.text },
          ]}
        >
          {message.text}
        </Text>
        <Text
          style={[
            bubbleStyles.time,
            { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted },
          ]}
        >
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: {
    marginVertical: 3,
    paddingHorizontal: 12,
  },
  wrapperOwn: {
    alignItems: 'flex-end',
  },
  wrapperOther: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600' as const,
    marginBottom: 3,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right' as const,
  },
});

export default function ChatScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    masterId: string;
    subscriberId: string;
    partnerName: string;
  }>();
  const { masterId, subscriberId, partnerName } = params;
  const {
    messages,
    loadMessages,
    sendMessage,
    markChatAsRead,
    isLoadingMessages,
    isSending,
    userId,
  } = useChat();

  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const hasScrolledRef = useRef(false);
  const keyboardHeightRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (masterId && subscriberId) {
      console.log('[ChatScreen] Loading messages for:', masterId, subscriberId);
      loadMessages(masterId, subscriberId);
      markChatAsRead(masterId, subscriberId);
    }
  }, [masterId, subscriberId, loadMessages, markChatAsRead]);

  useEffect(() => {
    if (messages.length > 0 && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (messages.length > 0 && hasScrolledRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [messages]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 150);
    });

    const onHide = Keyboard.addListener(hideEvent, () => {});

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    if (masterId && subscriberId && messages.length > 0) {
      markChatAsRead(masterId, subscriberId);
    }
  }, [messages, masterId, subscriberId, markChatAsRead]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !masterId || !subscriberId) return;
    setText('');
    await sendMessage(masterId, subscriberId, trimmed);
  }, [text, masterId, subscriberId, sendMessage]);

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble
        message={item}
        isOwn={item.senderId === userId}
        colors={colors}
      />
    ),
    [userId, colors]
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: partnerName || 'Чат' }} />

      {isLoadingMessages && messages.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Нет сообщений</Text>
          <Text style={styles.emptySubtext}>Начните разговор первыми!</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.messagesList}
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

      <View style={[styles.inputBar, { paddingBottom: Math.max(8, insets.bottom) }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Сообщение..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          testID="chat-input"
          onFocus={() => {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 300);
          }}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor:
                text.trim().length > 0 ? colors.primary : colors.surface,
            },
          ]}
          onPress={handleSend}
          disabled={isSending || text.trim().length === 0}
          activeOpacity={0.7}
          testID="chat-send-btn"
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Send
              size={18}
              color={text.trim().length > 0 ? '#fff' : colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
    },
    messagesList: {
      paddingVertical: 12,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      gap: 8,
    },
    input: {
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
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
