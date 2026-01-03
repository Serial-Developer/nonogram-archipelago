<script setup>
  useHead({
    script: [
      {
        async: true,
        src: 'https://client.sleekplan.com/sdk/e.js',
      },
    ],
  });

  // Initialize Sleekplan
  if (process.client) {
    window.$sleek = [];
    window.SLEEK_PRODUCT_ID = 235244264;
  }
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
