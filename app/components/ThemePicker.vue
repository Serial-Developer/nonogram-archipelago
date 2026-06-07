<script setup lang="ts">
  import { ref, nextTick, onBeforeUnmount } from 'vue';
  import { useTheme } from '~/composables/useTheme';
  import { themeList } from '~/utils/themes';

  const { themeId, setThemeById } = useTheme();

  const isOpen = ref(false);
  const btnRef = ref<HTMLElement | null>(null);
  const menuStyle = ref<Record<string, string>>({});

  // Position the (teleported, fixed) menu under the button so it escapes the
  // Settings panel's overflow clipping and the panels' stacking contexts.
  function place() {
    const el = btnRef.value;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const w = 256; // w-64
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    menuStyle.value = { top: `${r.bottom + 4}px`, left: `${left}px`, width: `${w}px` };
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
  onBeforeUnmount(close);
</script>

<template>
  <div class="relative">
    <!-- Theme Picker Button -->
    <button
      ref="btnRef"
      @click="toggle"
      class="btn-secondary flex items-center gap-2 text-sm"
      :title="$t('theme.openTitle')"
      :aria-label="$t('theme.selectAria')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.5a2 2 0 00-1 .276m-4 5.414l-2.5-2.5"
        />
      </svg>
      <span class="hidden sm:inline">{{ $t('theme.names.' + themeId) }}</span>
    </button>

    <!-- Dropdown teleported to body: fixed + high z-index so it is never clipped
         by the Settings panel overflow nor covered by sibling panels. -->
    <Teleport to="body">
      <div v-if="isOpen">
        <div @click="close" class="fixed inset-0 z-[999]" :aria-label="$t('theme.closeAria')"></div>
        <div
          class="tp-menu fixed z-[1000] rounded-lg shadow-lg p-3"
          :style="menuStyle"
          role="menu"
          :aria-label="$t('theme.menuAria')"
        >
          <div class="space-y-2">
            <div class="tp-heading px-3 py-2 text-xs font-semibold uppercase">{{ $t('theme.choose') }}</div>
            <div class="space-y-1">
              <button
                v-for="theme in themeList"
                :key="theme.id"
                @click="setThemeById(theme.id)"
                :aria-pressed="themeId === theme.id"
                class="tp-item w-full text-left px-3 py-2 rounded-md transition-all duration-200 text-sm"
                :class="themeId === theme.id ? 'tp-item-active font-medium' : ''"
              >
                <div class="font-medium">{{ $t('theme.names.' + theme.id) }}</div>
                <div class="text-xs opacity-75">{{ $t('theme.descs.' + theme.id) }}</div>
              </button>
            </div>
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
  .tp-menu {
    background-color: var(--color-glass-bg);
    border: 1px solid var(--color-glass-border);
    color: var(--color-text-primary);
  }
  .tp-heading {
    color: var(--color-section-heading);
  }
  .tp-item {
    color: var(--color-text-primary);
  }
  .tp-item:hover {
    background-color: var(--color-tab-inactive-bg);
  }
  .tp-item-active {
    background-color: var(--color-primary-color);
    color: var(--color-btn-primary-text);
  }
</style>
