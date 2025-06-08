// src/background/settings.ts
import browser, { type Storage } from 'webextension-polyfill';
import { startOrStopPollingBasedOnSettings } from './message-polling'

// --- Settings Keys ---
const POLLING_ENABLED_KEY = 'settings_pollingEnabled';
const POLLING_INTERVAL_KEY = 'settings_pollingInterval';

// --- Exported Settings State ---
// These are mutated by the functions in this file.
export let pollingEnabled = false;
export let pollingIntervalMs = 20000;

/**
 * Loads the initial settings from browser.storage.local.
 */
export async function initializeSettings(): Promise<void> {
  const defaults = {
    [POLLING_ENABLED_KEY]: false,
    [POLLING_INTERVAL_KEY]: 20000,
  };
  const settings = await browser.storage.local.get(defaults);

  pollingEnabled = settings[POLLING_ENABLED_KEY] as boolean;
  pollingIntervalMs = settings[POLLING_INTERVAL_KEY] as number;

  console.info(`BG-Settings: Initial settings loaded. Polling: ${pollingEnabled}, Interval: ${pollingIntervalMs}ms`);
}

/**
 * Handles changes to settings in browser.storage.
 * @param changes - The changes object from the storage event.
 * @param area - The storage area where the change occurred.
 */
export function handleSettingsChanges(changes: { [key: string]: Storage.StorageChange }, area: string): void {
  if (area !== 'local') return;

  let settingsChanged = false;

  const newPollingEnabled = changes[POLLING_ENABLED_KEY]?.newValue;
  if (newPollingEnabled !== undefined) {
    pollingEnabled = !!newPollingEnabled;
    settingsChanged = true;
    console.info(`BG-Settings: Polling 'enabled' setting changed to: ${pollingEnabled}`);
  }

  const newInterval = changes[POLLING_INTERVAL_KEY]?.newValue;
  if (newInterval !== undefined) {
    const ms = Number(newInterval);
    if (!isNaN(ms) && ms >= 2000) {
      pollingIntervalMs = ms;
      settingsChanged = true;
      console.info(`BG-Settings: Polling 'interval' setting changed to: ${pollingIntervalMs}ms`);
    }
  }

  if (settingsChanged) {
    // If settings changed, we need to restart the polling with the new values.
    startOrStopPollingBasedOnSettings();
  }
}