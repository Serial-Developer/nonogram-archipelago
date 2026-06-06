import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2025-12-18',
  devtools: { enabled: true },
  css: ['./app/assets/css/main.css'],

  // Disable SSR for the game - it's highly client-dependent
  ssr: false,

  modules: ['@nuxtjs/i18n'],

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    lazy: true,
    locales: [
      { code: 'en', language: 'en-US', name: 'English', file: 'en.json' },
      { code: 'fr', language: 'fr-FR', name: 'Fran\u00e7ais', file: 'fr.json' },
    ],
    // EN by default, but switch to FR when the browser language is French; remembered via cookie.
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'nono_locale',
      fallbackLocale: 'en',
    },
  },

  app: {
    head: {
      htmlAttrs: {
        style: 'background-color: #0a0a0a;',
      },
      bodyAttrs: {
        style: 'background-color: #0a0a0a; margin: 0;',
      },
      meta: [
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
        },
        {
          name: 'theme-color',
          content: '#0a0a0a',
        },
      ],
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap',
        },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
