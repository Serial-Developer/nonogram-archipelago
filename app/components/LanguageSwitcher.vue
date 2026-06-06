<script setup lang="ts">
  import { ref } from 'vue';

  // useI18n is auto-imported by @nuxtjs/i18n.
  const { locale, locales, setLocale } = useI18n();
  const isOpen = ref(false);
  function pick(code: string) {
    void setLocale(code);
    isOpen.value = false;
  }
</script>

<template>
  <div class="relative">
    <button
      @click="isOpen = !isOpen"
      class="btn-secondary flex items-center gap-2 text-sm"
      :title="$t('language.label')"
      :aria-label="$t('language.label')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18M3 12a9 9 0 0118 0 9 9 0 01-18 0z" />
      </svg>
      <span class="hidden sm:inline uppercase">{{ locale }}</span>
    </button>

    <div v-if="isOpen" @click="isOpen = false" class="fixed inset-0 z-40" aria-label="Close language menu"></div>

    <div
      v-show="isOpen"
      class="absolute right-0 mt-2 w-44 bg-color-glass-bg border border-color-glass-border rounded-lg shadow-lg z-50 p-2"
      role="menu"
      :aria-label="$t('language.label')"
    >
      <button
        v-for="l in locales"
        :key="l.code"
        @click="pick(l.code)"
        :aria-pressed="locale === l.code"
        class="w-full text-left px-3 py-2 rounded-md transition-all duration-200 text-sm"
        :class="
          locale === l.code
            ? 'bg-color-primary-color text-color-btn-primary-text font-medium'
            : 'text-color-text-primary hover:bg-color-tab-inactive-bg'
        "
      >
        {{ l.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
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
