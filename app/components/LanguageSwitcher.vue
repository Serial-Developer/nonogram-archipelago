<script setup lang="ts">
  import { ref } from 'vue';

  // useI18n is auto-imported by @nuxtjs/i18n.
  const { locale, locales, setLocale } = useI18n();
  const isOpen = ref(false);
  function pick(code: string) {
    void setLocale(code);
    isOpen.value = false;
  }

  // Inline SVG flags (emoji flags don't render on Windows). Keyed by locale code.
  const flags: Record<string, string> = {
    en: '<svg viewBox="0 0 60 30" width="100%" height="100%" preserveAspectRatio="none"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="3"/><rect x="25" width="10" height="30" fill="#fff"/><rect y="10" width="60" height="10" fill="#fff"/><rect x="27" width="6" height="30" fill="#C8102E"/><rect y="12" width="60" height="6" fill="#C8102E"/></svg>',
    fr: '<svg viewBox="0 0 60 30" width="100%" height="100%" preserveAspectRatio="none"><rect width="20" height="30" fill="#0055A4"/><rect x="20" width="20" height="30" fill="#fff"/><rect x="40" width="20" height="30" fill="#EF4135"/></svg>',
  };
</script>

<template>
  <div class="relative">
    <button
      @click="isOpen = !isOpen"
      class="btn-secondary flex items-center gap-2 text-sm"
      :title="$t('language.label')"
      :aria-label="$t('language.label')"
    >
      <span
        class="inline-flex w-5 h-[14px] rounded-sm overflow-hidden border border-black/20"
        v-html="flags[locale] || flags.en"
      ></span>
      <span class="hidden sm:inline uppercase">{{ locale }}</span>
    </button>

    <div v-if="isOpen" @click="isOpen = false" class="fixed inset-0 z-40" aria-label="Close language menu"></div>

    <div
      v-show="isOpen"
      class="absolute right-0 mt-2 bg-color-glass-bg border border-color-glass-border rounded-lg shadow-lg z-50 p-2"
      role="menu"
      :aria-label="$t('language.label')"
    >
      <div class="flex items-center gap-2">
        <button
          v-for="l in locales"
          :key="l.code"
          @click="pick(l.code)"
          :aria-pressed="locale === l.code"
          :title="l.name"
          class="flex flex-col items-center gap-1 px-3 py-2 rounded-md transition-all duration-200 text-xs"
          :class="
            locale === l.code
              ? 'bg-color-primary-color text-color-btn-primary-text font-medium'
              : 'text-color-text-primary hover:bg-color-tab-inactive-bg'
          "
        >
          <span
            class="inline-flex w-7 h-[18px] rounded-sm overflow-hidden border border-black/20"
            v-html="flags[l.code]"
          ></span>
          <span class="uppercase">{{ l.code }}</span>
        </button>
      </div>
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
