// src/types/bridge.d.ts
import type { ProcessedMessage } from '../stores/messages.store';
import type { SearchableItem } from '../stores/search.store';

// Define the structure for the last year's data
interface LastYearDataItem {
  code: string;
  name: string;
}

export interface LastYearData {
  paa: LastYearDataItem[];
  oikologika: LastYearDataItem[];
  enisxyseis: LastYearDataItem[];
}

export interface BackgroundState {
  currentApplicationId: string | null;
  messages: ProcessedMessage[];
  isLoading: boolean;
  lastError: string | null;
  changeCounters: {
    newErrors: number;
    newWarnings: number;
    newInfos: number;
    removedMessages: number;
  };
  // Προσθέστε τυχόν άλλα πεδία κατάστασης που χρειάζονται τα components
  'item-selected': Omit<SearchableItem, 'selection_count'>;
  // Last year data
  'get-last-year-data': void;
}

export interface MessagePayloads {
  'get-initial-state': void;
  'dismiss-message-once': { messageId: string };
  'dismiss-message-permanently': { messageId: string };
  'clear-change-counters': void;
  'popup-visibility-changed': { visible: boolean };
  'url-changed-for-id-check': { url: string }; // Νέο μήνυμα από το content script
  // Search related
  'get-search-suggestions': { searchTerm: string };
  'item-selected': Omit<SearchableItem, 'selection_count'>;
}

export interface BackgroundResponsePayloads {
  'get-initial-state': BackgroundState;
  'get-search-suggestions': SearchableItem[];
  'get-last-year-data': { data: LastYearData | null, error?: string };
}

export interface BackgroundEvents {
  'state-updated': BackgroundState;
  'show-error-notifications': Array<{ id: string, text: string }>;
  'last-year-data-updated': { data: LastYearData | null, error?: string };
}

// Για το setup του webext-bridge
declare module 'webext-bridge' {
  export interface ProtocolMap {
    // define message protocol types
    // (keys are message names, value can be any type)
    'get-initial-state': { data: void; response: BackgroundResponsePayloads['get-initial-state'] };
    'dismiss-message': { data: { messageId: string, permanent: boolean } };
    'clear-change-counters': { data: void };
    'popup-visibility-changed': { data: { visible: boolean } };
    
    // Search related messages
    'get-search-suggestions': { 
      data: MessagePayloads['get-search-suggestions'], 
      response: BackgroundResponsePayloads['get-search-suggestions'] 
    };
    'item-selected': { data: MessagePayloads['item-selected'] };

    // Last year data
    'get-last-year-data': {
      data: void,
      response: BackgroundResponsePayloads['get-last-year-data']
    };

    // Events from background to content script
    'state-updated': { data: BackgroundEvents['state-updated'] };
    'show-error-notifications': { data: BackgroundEvents['show-error-notifications'] };
    'last-year-data-updated': { data: BackgroundEvents['last-year-data-updated'] };
  }
}