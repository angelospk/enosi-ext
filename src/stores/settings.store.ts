// src/stores/settings.store.ts (New File)

import { defineStore } from 'pinia';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';

export const useSettingsStore = defineStore('settings', () => {
  // --- Polling Settings ---
  const { data: pollingEnabled, promise: pollingEnabledPromise } =
    useBrowserLocalStorage<boolean>('settings_pollingEnabled', false);

  const { data: pollingInterval, promise: pollingIntervalPromise } =
    useBrowserLocalStorage<number>('settings_pollingInterval', 20000); // Default 20 seconds

  // --- Other Settings (Example) ---
  // A useful setting could be to automatically restore dismissed messages when viewing a new application.
  const { data: restoreDismissedOnNewApp, promise: restoreDismissedPromise } =
    useBrowserLocalStorage<boolean>('settings_restoreDismissedOnNewApp', false);

  // --- Gemini AI Settings ---
  const { data: geminiApiKey, promise: geminiApiKeyPromise } =
    useBrowserLocalStorage<string | null>('settings_geminiApiKey', null);

  // Settings are now managed directly by the background script by listening to browser.storage.onChanged.
  // This avoids runtime errors when other contexts (like popups) are closed.

  // Ensure all settings are loaded before use if needed, though useBrowserLocalStorage handles this well.
  const promises = [pollingEnabledPromise, pollingIntervalPromise, restoreDismissedPromise, geminiApiKeyPromise];
  const allSettingsLoaded = Promise.all(promises);

  return {
    // State
    pollingEnabled,
    pollingInterval,
    restoreDismissedOnNewApp,
    geminiApiKey,

    // Status
    allSettingsLoaded,
  };
});