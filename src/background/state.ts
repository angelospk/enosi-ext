import { createPinia } from 'pinia';
import { useMessageStore } from '../stores/messages.store';
import { useSearchStore } from '../stores/search.store';
import { useSettingsStore } from '../stores/settings.store';

// Create a single Pinia instance for the entire background script
export const pinia = createPinia();

// Initialize and export a single instance of each store
export const messageStore = useMessageStore(pinia);
export const searchStore = useSearchStore(pinia);
export const settingsStore = useSettingsStore(pinia); 