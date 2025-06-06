// src/stores/settings.store.ts (New File)

import { defineStore } from 'pinia';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';
import { sendMessage } from 'webext-bridge/content-script';
import { watch } from 'vue';

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

  // When polling is enabled/disabled, notify the background script.
  watch(pollingEnabled, (newValue) => {
    sendMessage('set-polling-enabled', newValue).catch(e => console.warn('Failed to set polling enabled', e));
  });

  // When the interval changes, notify the background script.
  watch(pollingInterval, (newValue) => {
    // Basic validation
    if (typeof newValue === 'number' && newValue >= 2000) {
      sendMessage('set-polling-interval', newValue).catch(e => console.warn('Failed to set polling interval', e));
    }
  });

  // Ensure all settings are loaded before use if needed, though useBrowserLocalStorage handles this well.
  const promises = [pollingEnabledPromise, pollingIntervalPromise, restoreDismissedPromise];
  const allSettingsLoaded = Promise.all(promises);

  return {
    // State
    pollingEnabled,
    pollingInterval,
    restoreDismissedOnNewApp,

    // Status
    allSettingsLoaded,
  };
});