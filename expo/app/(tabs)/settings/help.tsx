import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Linking,
} from 'react-native';
import {
  ChevronDown,
  Building2,
  ClipboardCheck,
  Package,
  Bell,
  BookOpen,
  CloudUpload,
  Settings,
  Info,
  Mail,
  HelpCircle,
  Radio,
  Link2,
  Cloud,
} from 'lucide-react-native';
import { useThemeColors } from '@/providers/ThemeProvider';
import { ThemeColors } from '@/constants/colors';

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: string[];
}

function AccordionItem({
  section,
  isExpanded,
  onToggle,
  colors,
}: {
  section: HelpSection;
  isExpanded: boolean;
  onToggle: () => void;
  colors: ThemeColors;
}) {
  const animatedHeight = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const toggle = useCallback(() => {
    const toValue = isExpanded ? 0 : 1;
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(rotateAnim, {
        toValue,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle();
  }, [isExpanded, animatedHeight, rotateAnim, onToggle]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const maxHeight = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2000],
  });

  const styles = useMemo(() => createItemStyles(colors), [colors]);

  return (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        style={styles.itemHeader}
        onPress={toggle}
        activeOpacity={0.7}
        testID={`help-section-${section.id}`}
      >
        <View style={styles.itemIconWrap}>
          {section.icon}
        </View>
        <Text style={styles.itemTitle}>{section.title}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={18} color={colors.textMuted} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
        <View style={styles.itemContent}>
          {section.content.map((line, idx) => {
            const isBullet = line.startsWith('\u2022');
            const isStep = /^\d+\./.test(line);
            const isHeader = line.endsWith(':') && !isBullet && !isStep && line.length < 60;
            return (
              <Text
                key={idx}
                style={[
                  styles.contentText,
                  (isBullet || isStep) && styles.bulletText,
                  isHeader && styles.headerText,
                ]}
              >
                {line}
              </Text>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

export default function HelpScreen() {
  const colors = useThemeColors();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const sections: HelpSection[] = useMemo(() => [
    {
      id: 'objects',
      title: 'Объекты',
      icon: <Building2 size={20} color={colors.primary} />,
      content: [
        'Объекты - ваши рабочие площадки.',
        '',
        'Создание:',
        '1. На главном экране нажмите "+".',
        '2. Укажите название и адрес.',
        '3. Нажмите "Сохранить".',
        '',
        'Группы объектов:',
        '\u2022 Создавайте группы для удобной организации.',
        '\u2022 Перемещайте объекты между группами.',
        '\u2022 Сортируйте по алфавиту (А-Я / Я-А).',
        '',
        'Системы:',
        '\u2022 Добавляйте обслуживаемые системы в карточке объекта (СПС, СОУЭ, ВПВ и др.).',
        '\u2022 При создании записи в истории работ можно выбрать систему из списка.',
        '',
        'Контакты:',
        '\u2022 Добавляйте ответственных лиц с ФИО, должностью и телефоном.',
        '',
        'Документы:',
        '\u2022 Загружайте PDF, договоры, планы в карточку объекта.',
        '',
        'История работ:',
        '\u2022 Создавайте записи с описанием, фото и использованными материалами.',
        '\u2022 Указывайте систему, к которой относится работа.',
        '\u2022 Материалы автоматически списываются со склада.',
      ],
    },
    {
      id: 'checklists',
      title: 'Чек-листы',
      icon: <ClipboardCheck size={20} color={colors.success} />,
      content: [
        'Контроль качества работ по стандартным процедурам.',
        '',
        'Создание шаблона:',
        '1. Раздел "Задачи" - вкладка "Чек-листы".',
        '2. Нажмите "+", добавьте название и пункты проверки.',
        '',
        'Выполнение:',
        '1. Откройте объект - "Запустить чек-лист".',
        '2. Отмечайте пункты, добавляйте комментарии.',
        '',
        'Результаты сохраняются в истории объекта.',
      ],
    },
    {
      id: 'inventory',
      title: 'Склад',
      icon: <Package size={20} color={colors.warning} />,
      content: [
        'Учет материалов, инструментов и расходников.',
        '',
        'Добавление:',
        '1. Вкладка "Склад" - нажмите "+".',
        '2. Укажите название, единицу, количество и мин. запас.',
        '',
        'Категории:',
        '\u2022 Создавайте категории (Датчики, Батарейки, Кабель и т.д.).',
        '\u2022 Назначайте категорию при создании или через редактирование материала.',
        '\u2022 Материалы отображаются в раскрывающихся блоках по категориям.',
        '',
        'Поиск и сортировка:',
        '\u2022 Используйте строку поиска для быстрого нахождения.',
        '\u2022 Переключайте сортировку А-Я / Я-А.',
        '',
        'Списание:',
        '\u2022 При создании записи в истории объекта укажите материалы.',
        '\u2022 Количество автоматически уменьшается.',
        '\u2022 Предупреждение при низком остатке.',
      ],
    },
    {
      id: 'reminders',
      title: 'Напоминания и заявки',
      icon: <Bell size={20} color={colors.info} />,
      content: [
        'Задачи с привязкой к дате и объекту.',
        '',
        'Создание:',
        '1. Раздел "Задачи" - "Напоминания" - "+".',
        '2. Заполните описание, при необходимости укажите дату.',
        '3. Привяжите к объекту (выбор из списка или создание нового).',
        '',
        'Задачи без даты:',
        '\u2022 Дата необязательна - задача будет "без срока".',
        '\u2022 Отмечайте выполненной вручную.',
        '',
        'Уведомления:',
        '\u2022 Push-уведомления в назначенное время (если указана дата).',
      ],
    },
    {
      id: 'knowledge',
      title: 'База знаний',
      icon: <BookOpen size={20} color={colors.secondary} />,
      content: [
        'Хранение инструкций, нормативов и справочных материалов.',
        '',
        'Категории:',
        '\u2022 Создавайте свои категории (Инструкции, Схемы, Нормативы и т.д.).',
        '\u2022 Переименовывайте и удаляйте категории.',
        '\u2022 Перемещайте файлы между категориями.',
        '',
        'Добавление:',
        '1. Нажмите иконку файла - загрузите PDF, JPEG или другой документ.',
        '2. Нажмите "+" - создайте текстовую заметку.',
        '3. Выберите категорию при добавлении.',
        '',
        'Поиск:',
        '\u2022 Строка поиска для быстрого нахождения.',
        '\u2022 Категории отображаются раскрывающимися блоками.',
      ],
    },
    {
      id: 'backup',
      title: 'Синхронизация и подписки',
      icon: <CloudUpload size={20} color="#9C27B0" />,
      content: [
        'Защита данных от потери через Яндекс Диск.',
        '',
        'Подключение:',
        '1. Настройки - Синхронизация и подписки - Войти через Яндекс.',
        '',
        'Операции:',
        '\u2022 "Создать бэкап" - все данные загружаются на Диск.',
        '\u2022 "Восстановить" - выберите копию из списка.',
        '\u2022 Авто-бэкап по расписанию.',
        '',
        'Управление аккаунтом:',
        '\u2022 Сменить аккаунт или выйти можно в настройках.',
        '\u2022 При смене аккаунта настройки мастера сбрасываются.',
      ],
    },
    {
      id: 'syncpanel',
      title: 'Синхронизация',
      icon: <Cloud size={20} color={colors.primary} />,
      content: [
        'Быстрый доступ ко всем операциям синхронизации.',
        '',
        'Панель синхронизации:',
        '\u2022 Нажмите иконку облака на экране.',
        '\u2022 Текущий профиль, кнопка обновления и публикации.',
        '\u2022 Выбор интервала авто-синхронизации.',
        '\u2022 Публичная ссылка и QR-код для мастера.',
      ],
    },
    {
      id: 'master',
      title: 'Режим мастера',
      icon: <Radio size={20} color={colors.success} />,
      content: [
        'Публикация данных для подписчиков.',
        '',
        'Настройка:',
        '1. Подключите Яндекс.Диск.',
        '2. Включите режим мастера в настройках.',
        '3. Получите ссылку и QR-код.',
        '',
        '\u2022 Авто-публикация: каждый час, 12ч или 24ч.',
        '\u2022 Быстрая публикация через панель синхронизации.',
      ],
    },
    {
      id: 'subscriber',
      title: 'Режим подписчика',
      icon: <Link2 size={20} color={colors.info} />,
      content: [
        'Получение данных от мастеров.',
        '',
        'Добавление подписки:',
        '1. Управление подписками - "+".',
        '2. Введите ссылку или отсканируйте QR-код.',
        '',
        '\u2022 Авто-синхронизация по расписанию.',
        '\u2022 Переключение между подписками через панель.',
        '\u2022 Данные подписчика - только для чтения.',
      ],
    },
    {
      id: 'settings',
      title: 'Настройки',
      icon: <Settings size={20} color={colors.textSecondary} />,
      content: [
        'PIN-код:',
        '\u2022 Установите при первом запуске, измените или отключите в настройках.',
        '',
        'Тема оформления:',
        '\u2022 Выберите одну из тем: тёмная, океан, изумруд, полночь, светлая.',
        '',
        'Экспорт:',
        '\u2022 Данные можно экспортировать в Excel.',
      ],
    },
  ], [colors]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleEmailPress = useCallback(() => {
    void Linking.openURL('mailto:klemeshov2@gmail.com');
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      testID="help-screen"
    >
      <View style={styles.introCard}>
        <View style={styles.introIconWrap}>
          <HelpCircle size={28} color={colors.primary} />
        </View>
        <Text style={styles.introTitle}>Журнал мастера</Text>
        <Text style={styles.introText}>
          Управление объектами, контроль работ, учёт материалов и организация задач. Все данные хранятся на устройстве с возможностью облачного резервного копирования.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Разделы приложения</Text>

      {sections.map(section => (
        <AccordionItem
          key={section.id}
          section={section}
          isExpanded={expandedId === section.id}
          onToggle={() => handleToggle(section.id)}
          colors={colors}
        />
      ))}

      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>Обратная связь</Text>
        <Text style={styles.contactText}>
          Вопросы или предложения:
        </Text>
        <TouchableOpacity style={styles.emailRow} onPress={handleEmailPress} activeOpacity={0.7}>
          <Mail size={18} color={colors.primary} />
          <Text style={styles.emailText}>klemeshov2@gmail.com</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.versionCard}>
        <View style={styles.versionRow}>
          <Info size={16} color={colors.textMuted} />
          <Text style={styles.versionLabel}>Версия приложения</Text>
        </View>
        <Text style={styles.versionValue}>1.3</Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 100,
    },
    introCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center' as const,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    introIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary + '15',
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginBottom: 12,
    },
    introTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.text,
      marginBottom: 8,
    },
    introText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      lineHeight: 20,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600' as const,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    contactCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: 20,
      marginTop: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contactTitle: {
      fontSize: 16,
      fontWeight: '700' as const,
      color: colors.text,
      marginBottom: 6,
    },
    contactText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 20,
    },
    emailRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      backgroundColor: colors.primary + '12',
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    emailText: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.primary,
    },
    versionCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    versionRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    versionLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
    versionValue: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.textSecondary,
    },
  });
}

function createItemStyles(colors: ThemeColors) {
  return StyleSheet.create({
    itemContainer: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden' as const,
    },
    itemHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      padding: 14,
    },
    itemIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginRight: 12,
    },
    itemTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600' as const,
      color: colors.text,
    },
    itemContent: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 2,
    },
    contentText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
      marginBottom: 2,
    },
    bulletText: {
      paddingLeft: 8,
    },
    headerText: {
      fontWeight: '600' as const,
      color: colors.text,
      marginTop: 4,
    },
  });
}
