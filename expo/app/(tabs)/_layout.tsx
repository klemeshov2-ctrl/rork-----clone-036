import { Tabs } from "expo-router";
import { LayoutList, Package, ListChecks, BookOpen, Settings, Bell } from "lucide-react-native";
import React from "react";
import { View, Text } from "react-native";
import { useThemeColors } from "@/providers/ThemeProvider";
import { useComments } from "@/providers/CommentsProvider";
import { SyncFloatingButton } from "@/components/SyncFloatingButton";
import { SyncBottomSheet } from "@/components/SyncBottomSheet";

function NotificationBadge({ count, color }: { count: number; color: string }) {
  if (count <= 0) return null;
  return (
    <View style={{
      position: 'absolute',
      top: -4,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: color,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      paddingHorizontal: 3,
    }}>
      <Text style={{ fontSize: 10, fontWeight: '700' as const, color: '#fff' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  const { unreadCount } = useComments();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.tabIconDefault,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="(home)"
          options={{
            title: "Объекты",
            tabBarIcon: ({ color }) => <LayoutList size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Склад",
            tabBarIcon: ({ color }) => <Package size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="checklists"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            title: "Задачи",
            tabBarIcon: ({ color }) => <ListChecks size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="knowledge"
          options={{
            title: "Знания",
            tabBarIcon: ({ color }) => <BookOpen size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: "Уведомления",
            tabBarIcon: ({ color }) => (
              <View>
                <Bell size={22} color={color} />
                <NotificationBadge count={unreadCount} color={colors.error} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Настройки",
            tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
          }}
        />
      </Tabs>
      <SyncFloatingButton />
      <SyncBottomSheet />
    </View>
  );
}
