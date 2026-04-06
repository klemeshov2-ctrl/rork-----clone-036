import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '@/providers/ThemeProvider';
import { useComments } from '@/providers/CommentsProvider';

export function NotificationBell({ size = 40 }: { size?: number }) {
  const colors = useThemeColors();
  const { unreadCount } = useComments();
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}
      onPress={() => router.push('/notifications' as any)}
      activeOpacity={0.7}
      testID="notification-bell"
    >
      <Bell size={size * 0.5} color={colors.text} />
      {unreadCount > 0 && (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.error },
          ]}
        >
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
