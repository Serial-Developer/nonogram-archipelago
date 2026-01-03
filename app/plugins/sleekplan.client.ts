export default defineNuxtPlugin(() => {
  // Ensure Sleekplan widget is initialized
  if (typeof window !== 'undefined') {
    // Initialize sleek array if not exists
    window.$sleek = window.$sleek || [];
    window.SLEEK_PRODUCT_ID = 235244264;

    // Check if widget loaded after a delay
    setTimeout(() => {
      console.log('Sleekplan check:', {
        $sleek: window.$sleek,
        SLEEK_PRODUCT_ID: window.SLEEK_PRODUCT_ID,
        widgetElements: document.querySelectorAll('[id*="sleek"]'),
      });
    }, 2000);
  }
});
