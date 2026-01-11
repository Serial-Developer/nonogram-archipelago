<script setup>
  import { useTheme } from '~/composables/useTheme';
  import { onMounted } from 'vue';

  const { initializeTheme } = useTheme();

  useHead({
    script: [
      {
        async: true,
        src: 'https://client.sleekplan.com/sdk/e.js',
      },
    ],
  });

  // Initialize Sleekplan
  if (typeof window !== 'undefined') {
    window.$sleek = [];
    window.SLEEK_PRODUCT_ID = 235244264;
  }

  // Initialize theme from localStorage
  onMounted(() => {
    initializeTheme();
  });
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
