import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';
import { useSettingsStore } from './settings.store';

export interface ProcessedMessage {
  id: string; // Μοναδικό ID, π.χ. hash του rawText
  rawText: string;
  cleanedText: string; // Κείμενο χωρίς το (Α/Α...)
  type: 'Error' | 'Warning' | 'Info';
  firstSeen: number; // Timestamp
  lastSeen: number;  // Timestamp
  isDismissedOnce?: boolean; // Για απόρριψη στην τρέχουσα συνεδρία
  originalIndex?: number; // Για διατήρηση σειράς από το API
}

// Βοηθητική συνάρτηση για τη δημιουργία ενός απλού hash ID για τα μηνύματα
function generateMessageId(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Μετατροπή σε 32bit integer
  }
  // Προσθήκη ενός τυχαίου μέρους για μείωση συγκρούσεων αν το κείμενο είναι πανομοιότυπο αλλά σημαίνει κάτι άλλο
  // αν και στην περίπτωσή μας, το ίδιο κείμενο σημαίνει το ίδιο μήνυμα.
  return Math.abs(hash).toString(36);
}

function categorizeMessage(text: string): ProcessedMessage['type'] {
  const lowerText = text.toLowerCase();
  if (lowerText.includes("πρέπει να") || lowerText.includes("δεν επιτρέπεται")) {
    return 'Error';
  }
  if (lowerText.includes("ενημερωτικό μήνυμα")) {
    return 'Info';
  }
  return 'Warning'; // Προεπιλογή, μπορείς να το αλλάξεις σε 'Info' αν προτιμάς
}


function cleanMessageText(rawText: string): string {
  //change the regex to anything inside () and remove the ()
  return rawText.replace(/\s*\(.*?\)$/, '').trim();
}

export const useMessageStore = defineStore('messages', () => {
  // This is now the "master list" of all messages for the current application,
  // including those that are permanently dismissed. We will filter them for display using computed properties.
  const messages = ref<ProcessedMessage[]>([]);
  const { data: permanentlyDismissedMessageIds, promise: dismissedPromise } =
    useBrowserLocalStorage<string[]>('permanentlyDismissedSystemMessages', []);
  
  const currentApplicationId = ref<string | null>(null);
  const isLoading = ref(false);
  const lastError = ref<string | null>(null);
  const changeCounters = ref<{ newMessages: number, removedMessages: number }>({ newMessages: 0, removedMessages: 0 });

  function setApplicationId(appId: string) {
    if (currentApplicationId.value !== appId) {
      console.log(`[MessageStore] Application ID changing from '${currentApplicationId.value}' to '${appId}'`);
      currentApplicationId.value = appId;
      messages.value = [];
      changeCounters.value = { newMessages: 0, removedMessages: 0 };

      // **NEW**: Check the setting to decide if we should clear dismissed messages
      const settingsStore = useSettingsStore();
      if (settingsStore.restoreDismissedOnNewApp) {
        permanentlyDismissedMessageIds.value = [];
      }

      if (!appId) {
          isLoading.value = false;
      }
    }
  }
  function clearApplicationId() {
    currentApplicationId.value = null;
    messages.value = [];
    changeCounters.value = { newMessages: 0, removedMessages: 0 };
    isLoading.value = false;
  }

  async function updateMessages(rawMessages: string[], newAppId?: string) {
    // ... (initial logic remains the same) ...
    isLoading.value = true;
    lastError.value = null;
    await dismissedPromise.value;

    const now = Date.now();
    const newProcessedMessages: ProcessedMessage[] = [];
    const incomingMessageIds = new Set<string>();

    // **IMPROVEMENT**: Keep track of old message IDs for accurate change detection
    const existingMessageIds = new Set(messages.value.map(m => m.id));

    rawMessages.forEach((rawText, index) => {
      const cleanedText = cleanMessageText(rawText);
      const id = generateMessageId(cleanedText);
      incomingMessageIds.add(id);

      const existingMessage = messages.value.find(m => m.id === id);
      if (existingMessage) {
        existingMessage.lastSeen = now; // **KEY CHANGE**: Always update lastSeen
        existingMessage.rawText = rawText;
        existingMessage.cleanedText = cleanedText;
        existingMessage.type = categorizeMessage(rawText);
        existingMessage.isDismissedOnce = false;
        newProcessedMessages.push(existingMessage);
      } else {
        newProcessedMessages.push({
          id,
          rawText,
          cleanedText,
          type: categorizeMessage(rawText),
          firstSeen: now,
          lastSeen: now,
          isDismissedOnce: false,
          originalIndex: index,
        });
      }
    });

    // **IMPROVED LOGIC**: More accurate change detection
    const newlyAddedCount = Array.from(incomingMessageIds).filter(id => !existingMessageIds.has(id)).length;
    const removedMessagesCount = Array.from(existingMessageIds).filter(id => !incomingMessageIds.has(id)).length;

    // Only update counters if there's an actual change to avoid unnecessary banner flashes
    if (newlyAddedCount > 0 || removedMessagesCount > 0) {
        changeCounters.value = {
            newMessages: newlyAddedCount,
            removedMessages: removedMessagesCount
        };
    }

    // **KEY CHANGE**: Sort by lastSeen descending (newest first)
    messages.value = newProcessedMessages.sort((a, b) => b.lastSeen - a.lastSeen);
    isLoading.value = false;
  }

  function dismissMessageOnce(messageId: string) {
    const message = messages.value.find(m => m.id === messageId);
    if (message) {
      message.isDismissedOnce = true;
    }
  }

  async function dismissMessagePermanently(messageId: string) {
    await dismissedPromise.value;
    if (!permanentlyDismissedMessageIds.value.includes(messageId)) {
      permanentlyDismissedMessageIds.value.push(messageId);
    }
    // **KEY CHANGE**: We NO LONGER remove the message from the main `messages` array.
    // The computed properties will now handle filtering it out from the visible list.
  }

  async function restoreDismissedMessage(messageId: string) {
    await dismissedPromise.value;
    const idx = permanentlyDismissedMessageIds.value.indexOf(messageId);
    if (idx !== -1) {
      permanentlyDismissedMessageIds.value.splice(idx, 1);
      // Because `visibleMessages` and `permanentlyDismissedMessages` depend on this array,
      // the UI will update instantly and reactively. No more waiting for the next poll.
    }
  }
  
  // *** COMPUTED PROPERTIES REFACTORED FOR CLARITY ***

  // All messages that are not dismissed for the session or permanently.
  // This is the list the user sees by default.
  const visibleMessages = computed(() => {
    return messages.value.filter(
      m => !m.isDismissedOnce && !permanentlyDismissedMessageIds.value.includes(m.id)
    );
  });

  // **NEW**: All messages that have been permanently dismissed.
  // We can now easily get their text and other data because they are still in the main `messages` array.
  const permanentlyDismissedMessages = computed(() => {
    return messages.value.filter(m => permanentlyDismissedMessageIds.value.includes(m.id));
  });

  const errorMessages = computed(() => visibleMessages.value.filter(m => m.type === 'Error'));
  const warningMessages = computed(() => visibleMessages.value.filter(m => m.type === 'Warning'));
  const infoMessages = computed(() => visibleMessages.value.filter(m => m.type === 'Info'));

  function clearChangeCounters() {
    changeCounters.value = { newMessages: 0, removedMessages: 0 };
  }

  return {
    // State
    currentApplicationId,
    messages, // The full master list
    isLoading,
    lastError,
    changeCounters,

    // Computed State for UI
    visibleMessages,
    permanentlyDismissedMessages, // <-- Export this new property
    errorMessages,
    warningMessages,
    infoMessages,

    // Actions
    setApplicationId,
    clearApplicationId,
    updateMessages,
    dismissMessageOnce,
    dismissMessagePermanently,
    restoreDismissedMessage,
    clearChangeCounters,
  };
});