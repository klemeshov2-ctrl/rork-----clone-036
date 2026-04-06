import AsyncStorage from '@react-native-async-storage/async-storage';

export type LogLevel = 'error' | 'warn' | 'info' | 'log';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  stack?: string;
  timestamp: number;
}

const LOGS_KEY = '@app_logs';
const MAX_LOGS = 100;

let logsCache: LogEntry[] = [];
let initialized = false;
let listeners: Array<() => void> = [];

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notifyListeners() {
  listeners.forEach(l => l());
}

export async function initLogger(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    const stored = await AsyncStorage.getItem(LOGS_KEY);
    if (stored) {
      logsCache = JSON.parse(stored);
    }
  } catch {
    logsCache = [];
  }

  const originalError = console.error;
  const originalWarn = console.warn;

  console.error = (...args: unknown[]) => {
    originalError(...args);
    const message = args.map(a => {
      if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
      if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a); } catch { return '[object]'; }
      }
      if (a === null || a === undefined) return '';
      return typeof a === 'string' ? a : JSON.stringify(a);
    }).join(' ');
    void addLogEntry('error', message);
  };

  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    const message = args.map(a => {
      if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a); } catch { return '[object]'; }
      }
      if (a === null || a === undefined) return '';
      return typeof a === 'string' ? a : JSON.stringify(a);
    }).join(' ');
    void addLogEntry('warn', message);
  };
}

async function addLogEntry(level: LogLevel, message: string, stack?: string): Promise<void> {
  const entry: LogEntry = {
    id: generateId(),
    level,
    message: message.slice(0, 2000),
    stack: stack?.slice(0, 2000),
    timestamp: Date.now(),
  };

  logsCache = [entry, ...logsCache].slice(0, MAX_LOGS);
  notifyListeners();

  try {
    await AsyncStorage.setItem(LOGS_KEY, JSON.stringify(logsCache));
  } catch {
    // ignore storage errors
  }
}

export function getLogs(): LogEntry[] {
  return logsCache;
}

export async function clearLogs(): Promise<void> {
  logsCache = [];
  notifyListeners();
  try {
    await AsyncStorage.removeItem(LOGS_KEY);
  } catch {
    // ignore
  }
}

export function getLogsAsText(): string {
  return logsCache.map(entry => {
    const date = new Date(entry.timestamp);
    const ts = `${date.toLocaleDateString('ru-RU')} ${date.toLocaleTimeString('ru-RU')}`;
    return `[${entry.level.toUpperCase()}] ${ts}\n${entry.message}${entry.stack ? `\n${entry.stack}` : ''}`;
  }).join('\n\n---\n\n');
}
