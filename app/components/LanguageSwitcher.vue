<script setup lang="ts">
  import { ref, nextTick, onBeforeUnmount } from 'vue';

  // useI18n is auto-imported by @nuxtjs/i18n.
  const { locale, locales, setLocale } = useI18n();
  const isOpen = ref(false);
  const btnRef = ref<HTMLElement | null>(null);
  const menuStyle = ref<Record<string, string>>({});

  // Position the (teleported, fixed) menu under the button so it escapes the
  // Settings panel's overflow clipping and the panels' stacking contexts.
  function place() {
    const el = btnRef.value;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - 160));
    menuStyle.value = { top: `${r.bottom + 4}px`, left: `${left}px` };
  }
  function open() {
    isOpen.value = true;
    void nextTick(place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
  }
  function close() {
    isOpen.value = false;
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
  }
  function toggle() {
    isOpen.value ? close() : open();
  }
  function pick(code: string) {
    void setLocale(code);
    close();
  }
  onBeforeUnmount(close);

  // Inline SVG flags (emoji flags don't render on Windows). Keyed by locale code.
  const flags: Record<string, string> = {
    en: '<svg viewBox="0 0 60 30" width="100%" height="100%" preserveAspectRatio="none"><rect width="60" height="30" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" stroke-width="3"/><rect x="25" width="10" height="30" fill="#fff"/><rect y="10" width="60" height="10" fill="#fff"/><rect x="27" width="6" height="30" fill="#C8102E"/><rect y="12" width="60" height="6" fill="#C8102E"/></svg>',
    fr: '<svg viewBox="0 0 60 30" width="100%" height="100%" preserveAspectRatio="none"><rect width="20" height="30" fill="#0055A4"/><rect x="20" width="20" height="30" fill="#fff"/><rect x="40" width="20" height="30" fill="#EF4135"/></svg>',
  };
</script>

<template>
  <div class="relative">
    <button
      ref="btnRef"
      @click="toggle"
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

    <!-- Dropdown teleported to body: fixed + high z-index so it is never clipped
         by the Settings panel overflow nor covered by sibling panels. -->
    <Teleport to="body">
      <div v-if="isOpen">
        <div @click="close" class="fixed inset-0 z-[999]" :aria-label="$t('language.closeAria')"></div>
        <div
          class="ls-menu fixed z-[1000] rounded-lg shadow-lg p-2"
          :style="menuStyle"
          role="menu"
          :aria-label="$t('language.label')"
        >
          <div class="flex flex-col gap-1">
            <button
              v-for="l in locales"
              :key="l.code"
              @click="pick(l.code)"
              :aria-pressed="locale === l.code"
              :title="l.name"
              class="ls-item flex flex-row items-center gap-2 w-full px-3 py-2 rounded-md transition-all duration-200 text-sm"
              :class="locale === l.code ? 'ls-item-active font-medium' : ''"
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
    </Teleport>
  </div>
</template>

<style scoped>
  /* Direct (non-:deep) selectors so styles still apply on teleported nodes,
     which keep this component's scope-id attribute. Colors come from theme vars. */
  .btn-secondary {
    background-color: var(--color-btn-secondary-bg);
    color: var(--color-btn-secondary-text);
    border-color: var(--color-btn-secondary-border);
  }
  .btn-secondary:hover {
    background-color: var(--color-btn-secondary-hover);
  }
  .ls-menu {
    background-color: var(--color-glass-bg);
    border: 1px solid var(--color-glass-border);
    color: var(--color-text-primary);
  }
  .ls-item {
    color: var(--color-text-primary);
  }
  .ls-item:hover {
    background-color: var(--color-tab-inactive-bg);
  }
  .ls-item-active {
    background-color: var(--color-primary-color);
    color: var(--color-btn-primary-text);
  }
</style>
