import { ref, watch, computed } from 'vue';
import { themes, defaultTheme, type Theme } from '~/utils/themes';

const THEME_STORAGE_KEY = 'nonogram-archipelago-theme';

const currentTheme = ref<Theme>(defaultTheme || Object.values(themes)[0]!);

export function useTheme() {
  // Load theme from localStorage on client side
  if (typeof window !== 'undefined' && currentTheme.value) {
    const storedThemeId = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedThemeId && themes[storedThemeId]) {
      currentTheme.value = themes[storedThemeId];
    }
  }

  // Apply theme to document
  const applyTheme = (theme: Theme) => {
    currentTheme.value = theme;
    if (typeof window !== 'undefined') {
      const root = document.documentElement;
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
      });
      localStorage.setItem(THEME_STORAGE_KEY, theme.id);
    }
  };

  // Set theme by ID
  const setThemeById = (themeId: string) => {
    const theme = themes[themeId];
    if (theme) {
      applyTheme(theme);
    }
  };

  // Initialize theme on component mount
  const initializeTheme = () => {
    if (typeof window !== 'undefined') {
      const storedThemeId = localStorage.getItem(THEME_STORAGE_KEY);
      const theme = (storedThemeId && themes[storedThemeId]) || defaultTheme || Object.values(themes)[0]!;
      applyTheme(theme);
    }
  };

  const themeId = computed(() => currentTheme.value.id);
  const themeName = computed(() => currentTheme.value.name);

  return {
    currentTheme,
    themeId,
    themeName,
    applyTheme,
    setThemeById,
    initializeTheme,
    themes,
  };
}
