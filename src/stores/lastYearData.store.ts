import { defineStore } from 'pinia';
import { ref } from 'vue';
import { sendMessage, onMessage } from 'webext-bridge/content-script';

// Structure for a single item
interface LastYearDataItem {
  code: string;
  name: string;
}

// Structure for the entire dataset
export interface LastYearData {
  paa: LastYearDataItem[];
  eco: LastYearDataItem[];
  con: LastYearDataItem[];
}

export const useLastYearDataStore = defineStore('lastYearData', () => {
  // --- STATE ---
  const data = ref<LastYearData | null>(null);
  const isLoading = ref(true);
  const error = ref<string | null>(null);

  // --- ACTIONS ---

  /**
   * Asks the background script to fetch the latest data.
   * This is a "fire-and-forget" call. The background script will send an 
   * update via 'last-year-data-updated' when it has the data.
   */
  function fetchLastYearData() {
    isLoading.value = true;
    error.value = null;
    sendMessage('request-last-year-data-fetch', {}).catch(e => {
        console.error("Failed to send request for last year data", e);
        error.value = "Failed to communicate with background script.";
        isLoading.value = false;
    });
  }

  // Listen for live updates pushed from the background script
  onMessage('last-year-data-updated', (message) => {
    const payload = message.data as { data?: LastYearData | null; error?: string | null };
    if (payload.error) {
        error.value = payload.error;
        data.value = null;
    } else {
        data.value = payload.data ?? null;
        error.value = null;
    }
    // The background pushes a message, so loading is complete.
    isLoading.value = false;
  });

  return {
    // State
    data,
    isLoading,
    error,
    // Actions
    fetchLastYearData,
  };
}); 