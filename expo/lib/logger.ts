import AsyncStorage from '@react-native-async-storage/async-storage';

export type LogLevel = 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  message: string;
  originalMessage?: string;
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

const ERROR_TRANSLATIONS: Array<[RegExp, string]> = [
  [/Missing or insufficient permissions/i, 'Недостаточно прав для выполнения операции'],
  [/Network request failed/i, 'Отсутствует интернет-соединение'],
  [/Failed to fetch/i, 'Не удалось выполнить сетевой запрос. Проверьте подключение к интернету'],
  [/timeout/i, 'Превышено время ожидания запроса'],
  [/Firebase: Error \(auth\/invalid-api-key\)/i, 'Ошибка авторизации: неверный ключ API'],
  [/Firebase: Error \(auth\/user-not-found\)/i, 'Ошибка авторизации: пользователь не найден'],
  [/Firebase: Error \(auth\/wrong-password\)/i, 'Ошибка авторизации: неверный пароль'],
  [/Firebase: Error \(auth\/too-many-requests\)/i, 'Слишком много попыток входа. Попробуйте позже'],
  [/Firebase: Error \(auth\/network-request-failed\)/i, 'Ошибка сети при авторизации. Проверьте интернет'],
  [/Firebase: Error \(auth\/invalid-credential\)/i, 'Ошибка авторизации: недействительные учётные данные'],
  [/Firebase: Error \(auth\/credential-already-in-use\)/i, 'Эти учётные данные уже привязаны к другому аккаунту'],
  [/Firebase: Error \(auth\/requires-recent-login\)/i, 'Требуется повторная авторизация'],
  [/Firebase: Error/i, 'Ошибка Firebase'],
  [/Failed to upload file/i, 'Не удалось загрузить файл'],
  [/Failed to download/i, 'Не удалось скачать файл'],
  [/Document not found/i, 'Документ не найден'],
  [/PERMISSION_DENIED/i, 'Доступ запрещён'],
  [/quota.exceeded/i, 'Превышена квота хранилища'],
  [/storage\/unauthorized/i, 'Нет доступа к хранилищу'],
  [/storage\/object-not-found/i, 'Файл не найден в хранилище'],
  [/Could not connect to the server/i, 'Не удалось подключиться к серверу'],
  [/JSON Parse error/i, 'Ошибка обработки данных (некорректный формат)'],
  [/SyntaxError/i, 'Синтаксическая ошибка в данных'],
  [/TypeError: (.*) is not a function/i, 'Внутренняя ошибка приложения'],
  [/TypeError: Cannot read propert/i, 'Внутренняя ошибка: доступ к несуществующему свойству'],
  [/TypeError/i, 'Внутренняя ошибка типов данных'],
  [/ReferenceError/i, 'Внутренняя ошибка: обращение к несуществующей переменной'],
  [/RangeError/i, 'Внутренняя ошибка: значение вне допустимого диапазона'],
  [/AsyncStorage/i, 'Ошибка локального хранилища'],
  [/Disk full/i, 'Недостаточно места на устройстве'],
  [/No such file or directory/i, 'Файл или папка не найдены'],
  [/OAuth/i, 'Ошибка авторизации через внешний сервис'],
  [/token.*expired/i, 'Срок действия токена авторизации истёк'],
  [/Unauthorized/i, 'Требуется авторизация'],
  [/403/i, 'Доступ запрещён (403)'],
  [/404/i, 'Ресурс не найден (404)'],
  [/500/i, 'Внутренняя ошибка сервера (500)'],
  [/502|503|504/i, 'Сервер временно недоступен'],
  [/ERR_CONNECTION_REFUSED/i, 'Соединение отклонено сервером'],
  [/ECONNRESET/i, 'Соединение было сброшено'],
  [/ENOTFOUND/i, 'Сервер не найден'],
  [/Invariant Violation/i, 'Внутренняя ошибка компонента'],
  [/Cannot.*null/i, 'Ошибка: обращение к пустому значению'],
  [/Yandex/i, 'Ошибка сервиса Яндекс'],
  [/disk.*api/i, 'Ошибка Яндекс.Диска'],
];

export function translateErrorMessage(error: string): string {
  if (!error || error.trim() === '') return 'Неизвестная ошибка';

  for (const [pattern, translation] of ERROR_TRANSLATIONS) {
    if (pattern.test(error)) {
      return translation;
    }
  }

  return `Ошибка: ${error}`;
}

const IGNORED_PATTERNS: RegExp[] = [
  /Warning:/i,
  /WARN/i,
  /Possible Unhandled Promise/i,
  /componentWillReceiveProps/i,
  /componentWillMount/i,
  /Require cycle/i,
  /ViewPropTypes/i,
  /AsyncStorage has been extracted/i,
  /Setting a timer/i,
  /VirtualizedLists should never be nested/i,
  /Each child in a list should have a unique/i,
  /Can't perform a React state update on an unmounted/i,
  /Non-serializable values were found in the navigation state/i,
];

function shouldIgnore(message: string): boolean {
  return IGNORED_PATTERNS.some(p => p.test(message));
}

export async function initLogger(): Promise<void> {
  if (initialized) return;
  initialized = true;

  try {
    const stored = await AsyncStorage.getItem(LOGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as LogEntry[];
      logsCache = parsed.filter(e => e.level === 'error');
    }
  } catch {
    logsCache = [];
  }

  const originalError = console.error;

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

    if (shouldIgnore(message)) return;

    void addLogEntry('error', message);
  };
}

async function addLogEntry(level: LogLevel, message: string, stack?: string): Promise<void> {
  const translated = translateErrorMessage(message);
  const entry: LogEntry = {
    id: generateId(),
    level,
    message: translated,
    originalMessage: message.slice(0, 2000),
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
    return `[ОШИБКА] ${ts}\n${entry.message}${entry.originalMessage ? `\n\nОригинал: ${entry.originalMessage}` : ''}${entry.stack ? `\n${entry.stack}` : ''}`;
  }).join('\n\n---\n\n');
}
