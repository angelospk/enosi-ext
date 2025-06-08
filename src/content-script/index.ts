// content-scripts/index.ts

import { initializeStateAndCommunication } from './state';
import { initializeUI } from './ui';
import { initializeSearch } from './search';
import { initializeShortcuts } from './shortcuts';

console.info("Extension: Content script loading.");

function main() {
  // Guard against running on the wrong page/subdomain
  if (!window.location.href.startsWith('https://eae2024.opekepe.gov.gr/eae2024')) {
    return;
  }
  console.info("Extension: Running on target site. Initializing modules.");

  // Initialize all modules
  initializeStateAndCommunication();
  initializeUI();
  initializeSearch();
  initializeShortcuts();

  // Initial attempt to set up helpers that depend on page content

  // Observe for DOM changes to initialize dynamic components like the community helper
  // if they are not present on the initial page load.
  const observer = new MutationObserver(() => {
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// --- Run main logic ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}