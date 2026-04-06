import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { Trash2, Copy, AlertTriangle, AlertCircle } from 'lucide-react-native';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';
import { getLogs, clearLogs, getLogsAsText, subscribe, LogEntry } from '@/lib/logger';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}:${seconds}`;
}

function LogEntryCard({ entry, colors }: { entry: LogEntry; colors: ThemeColors }) {
  const [expanded, setExpanded] = useState(false);
  const isError = entry.level === 'error';
  const levelColor = isError ? colors.error : colors.warning;
  const levelBg = isError ? colors.error + '15' : colors.warning + '15';

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.surfaceElevated,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: levelColor + '30',
        borderLeftWidth: 3,
        borderLeftColor: levelColor,
      }}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: 'row' as const, alignItems: 'center' as const, marginBottom: 6 }}>
        <View style={{
          backgroundColor: levelBg,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: 4,
          marginRight: 8,
        }}>
          {isError ? (
            <AlertCircle size={12} color={levelColor} />
          ) : (
            <AlertTriangle size={12} color={levelColor} />
          )}
          <Text style={{ fontSize: 10, fontWeight: '700' as const, color: levelColor, textTransform: 'uppercase' as const }}>
            {entry.level}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: colors.textMuted, fontVariant: ['tabular-nums' as const] }}>
          {formatTimestamp(entry.timestamp)}
        </Text>
      </View>
      <Text
        style={{ fontSize: 13, color: colors.text, lineHeight: 18 }}
        numberOfLines={expanded ? undefined : 3}
      >
        {entry.message}
      </Text>
      {entry.stack && expanded && (
        <View style={{ marginTop: 8, backgroundColor: colors.surface, borderRadius: 8, padding: 8 }}>
          <Text style={{ fontSize: 11, color: colors.textMuted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
            {entry.stack}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function LogsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [logs, setLogs] = useState<LogEntry[]>(getLogs());

  useEffect(() => {
    const unsub = subscribe(() => {
      setLogs([...getLogs()]);
    });
    return unsub;
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert('Очистить логи', 'Удалить все записи журнала?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await clearLogs();
          setLogs([]);
        },
      },
    ]);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      const text = getLogsAsText();
      if (!text) {
        Alert.alert('Пусто', 'Нет записей для копирования');
        return;
      }
      if (Platform.OS !== 'web') {
        const Clipboard = await import('expo-clipboard');
        await Clipboard.setStringAsync(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      Alert.alert('Скопировано', 'Логи скопированы в буфер обмена');
    } catch {
      Alert.alert('Ошибка', 'Не удалось скопировать');
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: LogEntry }) => (
    <LogEntryCard entry={item} colors={colors} />
  ), [colors]);

  const keyExtractor = useCallback((item: LogEntry) => item.id, []);

  const errorCount = useMemo(() => logs.filter(l => l.level === 'error').length, [logs]);
  const warnCount = useMemo(() => logs.filter(l => l.level === 'warn').length, [logs]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Журнал ошибок' }} />

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: colors.error + '30' }]}>
          <AlertCircle size={16} color={colors.error} />
          <Text style={[styles.statNumber, { color: colors.error }]}>{errorCount}</Text>
          <Text style={styles.statLabel}>ошибок</Text>
        </View>
        <View style={[styles.statCard, { borderColor: colors.warning + '30' }]}>
          <AlertTriangle size={16} color={colors.warning} />
          <Text style={[styles.statNumber, { color: colors.warning }]}>{warnCount}</Text>
          <Text style={styles.statLabel}>предупр.</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} activeOpacity={0.7}>
          <Copy size={16} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>Копировать</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { borderColor: colors.error + '30' }]} onPress={handleClear} activeOpacity={0.7}>
          <Trash2 size={16} color={colors.error} />
          <Text style={[styles.actionText, { color: colors.error }]}>Очистить</Text>
        </TouchableOpacity>
      </View>

      {logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <AlertTriangle size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Нет записей</Text>
          <Text style={styles.emptySubtext}>Ошибки и предупреждения будут отображаться здесь</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
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
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    statCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
    },
    statNumber: {
      fontSize: 18,
      fontWeight: '700',
    },
    statLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 10,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionText: {
      fontSize: 13,
      fontWeight: '600',
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    emptySubtext: {
      fontSize: 13,
      color: colors.textMuted,
      textAlign: 'center',
    },
    listContent: {
      padding: 16,
      paddingTop: 4,
    },
  });
}
