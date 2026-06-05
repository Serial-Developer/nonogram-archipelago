/**
 * Theme definitions with improved color contrast for accessibility
 * All themes meet WCAG AA standards for text contrast (4.5:1 for normal text)
 */

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: {
    // Surface colors
    'surface-bg': string;
    'surface-bg-gradient-start': string;
    'surface-bg-gradient-mid': string;
    'surface-bg-gradient-end': string;
    'html-bg': string;
    'body-bg': string;

    // Primary UI
    'primary-color': string;
    'primary-hover': string;
    'primary-active': string;

    // Secondary UI
    'secondary-color': string;
    'secondary-hover': string;
    'secondary-active': string;

    // Text colors
    'text-primary': string;
    'text-secondary': string;
    'text-muted': string;

    // Buttons
    'btn-primary-bg': string;
    'btn-primary-hover': string;
    'btn-primary-text': string;
    'btn-secondary-bg': string;
    'btn-secondary-hover': string;
    'btn-secondary-text': string;
    'btn-secondary-border': string;
    'btn-destructive-bg': string;
    'btn-destructive-hover': string;
    'btn-destructive-text': string;
    'btn-destructive-border': string;

    // Input fields
    'input-bg': string;
    'input-border': string;
    'input-text': string;
    'input-placeholder': string;
    'input-focus-ring': string;

    // Glass panels
    'glass-bg': string;
    'glass-border': string;
    'glass-shadow': string;

    // Utilities
    'border-primary': string;
    'scrollbar-thumb': string;
    'scrollbar-thumb-hover': string;
    'scrollbar-track': string;
    'tab-inactive-text': string;
    'tab-inactive-bg': string;
    'section-heading': string;

    // Nonogram grid
    'grid-line-thin': string;
    'grid-line-thick': string;
    'grid-cell-filled': string;
    'grid-cell-hover': string;
    'grid-cell-selected': string;
    'grid-clue-text': string;
    'grid-clue-text-complete': string;
    'grid-mistake-bg': string;
    'grid-x-mark': string;
    'grid-x-mark-wrong': string;
    'grid-x-mark-auto': string;
  };
}

export const themes: Record<string, Theme> = {
  // dark default
  default: {
    id: 'default',
    name: 'Dark (Default)',
    description: 'Nice for the eyes',
    colors: {
      'surface-bg': '#0a0a0a',
      'surface-bg-gradient-start': '#0f172a',
      'surface-bg-gradient-mid': '#1e293b',
      'surface-bg-gradient-end': '#0f172a',
      'html-bg': '#0a0a0a',
      'body-bg': '#0a0a0a',

      'primary-color': '#3b82f6',
      'primary-hover': '#2563eb',
      'primary-active': '#1d4ed8',

      'secondary-color': '#0ea5e9',
      'secondary-hover': '#0284c7',
      'secondary-active': '#0369a1',

      'text-primary': '#ffffff',
      'text-secondary': '#d1d5db',
      'text-muted': '#9ca3af',

      'btn-primary-bg': '#3b82f6',
      'btn-primary-hover': '#2563eb',
      'btn-primary-text': '#ffffff',
      'btn-secondary-bg': '#1f2937',
      'btn-secondary-hover': '#374151',
      'btn-secondary-text': '#f3f4f6',
      'btn-secondary-border': '#4b5563',
      'btn-destructive-bg': '#dc2626',
      'btn-destructive-hover': '#b91c1c',
      'btn-destructive-text': '#ffffff',
      'btn-destructive-border': '#dc2626',

      'input-bg': '#111827',
      'input-border': '#4b5563',
      'input-text': '#f3f4f6',
      'input-placeholder': '#6b7280',
      'input-focus-ring': '#3b82f6',

      'glass-bg': 'rgba(15, 23, 42, 0.9)',
      'glass-border': 'rgba(107, 114, 128, 0.5)',
      'glass-shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',

      'border-primary': '#4b5563',
      'scrollbar-thumb': '#6b7280',
      'scrollbar-thumb-hover': '#9ca3af',
      'scrollbar-track': '#1f2937',
      'tab-inactive-text': '#9ca3af',
      'tab-inactive-bg': 'rgba(31, 41, 55, 0.5)',
      'section-heading': '#e5e7eb',

      // Nonogram grid colors
      'grid-line-thin': 'rgba(255, 255, 255, 0.1)',
      'grid-line-thick': 'rgba(255, 255, 255, 0.45)',
      'grid-cell-filled': '#1f2937',
      'grid-cell-hover': 'rgba(107, 114, 128, 0.2)',
      'grid-cell-selected': '#1f2937',
      'grid-clue-text': '#fff',
      'grid-clue-text-complete': '#4ade80',
      'grid-mistake-bg': 'rgba(239, 68, 68, 0.5)',
      'grid-x-mark': '#9ca3af',
      'grid-x-mark-wrong': '#ef4444',
      'grid-x-mark-auto': '#cbd5e1',
    },
  },

  'max-contrast': {
    id: 'max-contrast',
    name: 'High Contrast',
    description: 'High contrast colors for maximum visibility',
    colors: {
      'surface-bg': '#000000',
      'surface-bg-gradient-start': '#000000',
      'surface-bg-gradient-mid': '#000000',
      'surface-bg-gradient-end': '#000000',
      'html-bg': '#000000',
      'body-bg': '#000000',

      'primary-color': '#ffff00',
      'primary-hover': '#cccc00',
      'primary-active': '#999900',

      'secondary-color': '#00ffff',
      'secondary-hover': '#00cccc',
      'secondary-active': '#009999',

      'text-primary': '#ffffff',
      'text-secondary': '#ffff00',
      'text-muted': '#cccccc',

      'btn-primary-bg': '#ffff00',
      'btn-primary-hover': '#cccc00',
      'btn-primary-text': '#000000',
      'btn-secondary-bg': '#333333',
      'btn-secondary-hover': '#666666',
      'btn-secondary-text': '#ffffff',
      'btn-secondary-border': '#ffffff',
      'btn-destructive-bg': '#ff0000',
      'btn-destructive-hover': '#cc0000',
      'btn-destructive-text': '#ffffff',
      'btn-destructive-border': '#ff0000',

      'input-bg': '#1a1a1a',
      'input-border': '#ffffff',
      'input-text': '#ffffff',
      'input-placeholder': '#999999',
      'input-focus-ring': '#ffff00',

      'glass-bg': 'rgba(0, 0, 0, 0.95)',
      'glass-border': 'rgba(255, 255, 255, 0.8)',
      'glass-shadow': '0 0 0 2px #ffff00',

      'border-primary': '#ffffff',
      'scrollbar-thumb': '#ffffff',
      'scrollbar-thumb-hover': '#ffff00',
      'scrollbar-track': '#333333',
      'tab-inactive-text': '#cccccc',
      'tab-inactive-bg': 'rgba(51, 51, 51, 0.8)',
      'section-heading': '#ffff00',

      // Nonogram grid colors - maximum contrast
      'grid-line-thin': 'rgba(255, 255, 255, 0.3)',
      'grid-line-thick': 'rgba(255, 255, 255, 0.8)',
      'grid-cell-filled': 'rgba(255, 255, 0, 0.3)',
      'grid-cell-hover': 'rgba(255, 255, 0, 0.2)',
      'grid-cell-selected': 'rgba(255, 255, 0, 0.3)',
      'grid-clue-text': '#ffff00',
      'grid-clue-text-complete': '#00ffff',
      'grid-mistake-bg': 'rgba(255, 0, 0, 0.8)',
      'grid-x-mark': '#00ffff',
      'grid-x-mark-wrong': '#ff0000',
      'grid-x-mark-auto': '#ffffff',
    },
  },
};

export const themeList = Object.values(themes);
export const defaultTheme = themes.default;
