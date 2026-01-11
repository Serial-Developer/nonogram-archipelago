<script setup lang="ts">
  import { ref } from 'vue';
  import { useTheme } from '~/composables/useTheme';
  import { themeList } from '~/utils/themes';

  const { themeId, themeName, setThemeById } = useTheme();

  const isOpen = ref(false);
</script>

<template>
  <div class="relative">
    <!-- Theme Picker Button -->
    <button
      @click="isOpen = !isOpen"
      class="btn-secondary flex items-center gap-2 text-sm"
      title="Open theme selector"
      aria-label="Select color theme"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.5a2 2 0 00-1 .276m-4 5.414l-2.5-2.5"
        />
      </svg>
      <span class="hidden sm:inline">{{ themeName }}</span>
    </button>

    <!-- Theme Dropdown Menu -->
    <div v-if="isOpen" @click="isOpen = false" class="fixed inset-0 z-40" aria-label="Close theme menu"></div>

    <div
      v-show="isOpen"
      class="absolute right-0 mt-2 w-64 bg-color-glass-bg border border-color-glass-border rounded-lg shadow-lg z-50 p-3"
      role="menu"
      aria-label="Theme selection menu"
    >
      <div class="space-y-2">
        <div class="px-3 py-2 text-xs font-semibold text-color-section-heading uppercase">Choose Theme</div>
        <div class="space-y-1">
          <button
            v-for="theme in themeList"
            :key="theme.id"
            @click="setThemeById(theme.id)"
            :aria-pressed="themeId === theme.id"
            class="w-full text-left px-3 py-2 rounded-md transition-all duration-200 text-sm"
            :class="
              themeId === theme.id
                ? 'bg-color-primary-color text-color-btn-primary-text font-medium'
                : 'text-color-text-primary hover:bg-color-tab-inactive-bg'
            "
          >
            <div class="font-medium">{{ theme.name }}</div>
            <div class="text-xs opacity-75">{{ theme.description }}</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  /* Use CSS variables for colors */
  .btn-secondary {
    background-color: var(--color-btn-secondary-bg);
    color: var(--color-btn-secondary-text);
    border-color: var(--color-btn-secondary-border);
  }

  .btn-secondary:hover {
    background-color: var(--color-btn-secondary-hover);
  }

  :deep(.bg-color-glass-bg) {
    background-color: var(--color-glass-bg);
  }

  :deep(.border-color-glass-border) {
    border-color: var(--color-glass-border);
  }

  :deep(.text-color-section-heading) {
    color: var(--color-section-heading);
  }

  :deep(.text-color-primary) {
    color: var(--color-text-primary);
  }

  :deep(.bg-color-primary-color) {
    background-color: var(--color-primary-color);
  }

  :deep(.text-color-btn-primary-text) {
    color: var(--color-btn-primary-text);
  }

  :deep(.text-color-text-primary) {
    color: var(--color-text-primary);
  }

  :deep(.bg-color-tab-inactive-bg) {
    background-color: var(--color-tab-inactive-bg);
  }
</style>
