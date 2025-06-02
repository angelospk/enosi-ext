// src/types/bridge.d.ts
import type { ProcessedMessage } from '../stores/messages.store';

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
}

export interface MessagePayloads {
  'get-initial-state': void;
  'dismiss-message-once': { messageId: string };
  'dismiss-message-permanently': { messageId: string };
  'clear-change-counters': void;
  'popup-visibility-changed': { visible: boolean };
  'url-changed-for-id-check': { url: string }; // Νέο μήνυμα από το content script
}

export interface BackgroundResponsePayloads {
  'get-initial-state': BackgroundState;
}

export interface BackgroundEvents {
  'state-updated': BackgroundState;
  'show-error-notifications': Array<{ id: string, text: string }>;
}

// Για το setup του webext-bridge
declare module 'webext-bridge' {
  export interface ProtocolMap {
    // define message protocol types
    // (keys are message names, value can be any type)
    'get-initial-state': MessagePayloads['get-initial-state'] extends void
      ? { data: void; response: BackgroundResponsePayloads['get-initial-state'] }
      : { data: MessagePayloads['get-initial-state']; response: BackgroundResponsePayloads['get-initial-state'] };
    'dismiss-message-once': { data: MessagePayloads['dismiss-message-once'] };
    'dismiss-message-permanently': { data: MessagePayloads['dismiss-message-permanently'] };
    'clear-change-counters': { data: MessagePayloads['clear-change-counters'] };
    'popup-visibility-changed': {data: MessagePayloads['popup-visibility-changed']};
    'url-changed-for-id-check': {data: MessagePayloads['url-changed-for-id-check']};

    // Events from background to content script
    'state-updated': BackgroundEvents['state-updated'];
    'show-error-notifications': BackgroundEvents['show-error-notifications'];
  }
}