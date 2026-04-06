export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  overlay: string;
}

export interface AppTheme {
  id: string;
  name: string;
  preview: string[];
  colors: ThemeColors;
}

const darkColors: ThemeColors = {
  primary: '#FF6B00',
  secondary: '#FF8C3A',
  background: '#0A0A0F',
  surface: '#141418',
  surfaceElevated: '#1C1C24',
  text: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textMuted: '#707070',
  border: '#2A2A35',
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFA726',
  info: '#42A5F5',
  tint: '#FF6B00',
  tabIconDefault: '#606068',
  tabIconSelected: '#FF6B00',
  overlay: 'rgba(0,0,0,0.7)',
};

const lightColors: ThemeColors = {
  primary: '#FF6B00',
  secondary: '#FF8C3A',
  background: '#F5F5F5',
  surface: '#EEEEEE',
  surfaceElevated: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textMuted: '#8A8A8A',
  border: '#D8D8D8',
  success: '#2E7D32',
  error: '#C62828',
  warning: '#EF6C00',
  info: '#1565C0',
  tint: '#FF6B00',
  tabIconDefault: '#8A8A8A',
  tabIconSelected: '#FF6B00',
  overlay: 'rgba(0,0,0,0.5)',
};

const blueColors: ThemeColors = {
  primary: '#4A9EFF',
  secondary: '#6BB5FF',
  background: '#0A0F1A',
  surface: '#121828',
  surfaceElevated: '#1A2236',
  text: '#FFFFFF',
  textSecondary: '#A0B4CC',
  textMuted: '#5A6E88',
  border: '#253048',
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFA726',
  info: '#4A9EFF',
  tint: '#4A9EFF',
  tabIconDefault: '#4A5568',
  tabIconSelected: '#4A9EFF',
  overlay: 'rgba(5,10,25,0.7)',
};

const purpleColors: ThemeColors = {
  primary: '#A855F7',
  secondary: '#C084FC',
  background: '#0F0A1A',
  surface: '#181228',
  surfaceElevated: '#221A36',
  text: '#FFFFFF',
  textSecondary: '#B4A0CC',
  textMuted: '#6E5A88',
  border: '#302548',
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFA726',
  info: '#42A5F5',
  tint: '#A855F7',
  tabIconDefault: '#544868',
  tabIconSelected: '#A855F7',
  overlay: 'rgba(10,5,20,0.7)',
};

const redColors: ThemeColors = {
  primary: '#EF4444',
  secondary: '#F87171',
  background: '#140A0A',
  surface: '#1E1214',
  surfaceElevated: '#2A1A1C',
  text: '#FFFFFF',
  textSecondary: '#CCA0A4',
  textMuted: '#885A5E',
  border: '#3D2528',
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFA726',
  info: '#42A5F5',
  tint: '#EF4444',
  tabIconDefault: '#684850',
  tabIconSelected: '#EF4444',
  overlay: 'rgba(15,5,5,0.7)',
};

const tealColors: ThemeColors = {
  primary: '#14B8A6',
  secondary: '#2DD4BF',
  background: '#0A1412',
  surface: '#12201E',
  surfaceElevated: '#1A2E2A',
  text: '#FFFFFF',
  textSecondary: '#A0CCB8',
  textMuted: '#5A8878',
  border: '#254840',
  success: '#66BB6A',
  error: '#EF5350',
  warning: '#FFA726',
  info: '#42A5F5',
  tint: '#14B8A6',
  tabIconDefault: '#486058',
  tabIconSelected: '#14B8A6',
  overlay: 'rgba(5,15,12,0.7)',
};

export const themes: AppTheme[] = [
  {
    id: 'dark',
    name: 'Тёмная (по умолчанию)',
    preview: ['#FF6B00', '#0A0A0F', '#1C1C24'],
    colors: darkColors,
  },
  {
    id: 'light',
    name: 'Светлая',
    preview: ['#FF6B00', '#F5F5F5', '#FFFFFF'],
    colors: lightColors,
  },
  {
    id: 'blue',
    name: 'Синяя',
    preview: ['#4A9EFF', '#0A0F1A', '#1A2236'],
    colors: blueColors,
  },
  {
    id: 'purple',
    name: 'Фиолетовая',
    preview: ['#A855F7', '#0F0A1A', '#221A36'],
    colors: purpleColors,
  },
  {
    id: 'red',
    name: 'Красная',
    preview: ['#EF4444', '#140A0A', '#2A1A1C'],
    colors: redColors,
  },
  {
    id: 'teal',
    name: 'Бирюзовая',
    preview: ['#14B8A6', '#0A1412', '#1A2E2A'],
    colors: tealColors,
  },
];

export default {
  light: {
    text: lightColors.text,
    background: lightColors.background,
    tint: lightColors.tint,
    tabIconDefault: lightColors.tabIconDefault,
    tabIconSelected: lightColors.tabIconSelected,
  },
};
