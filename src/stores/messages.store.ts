import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';

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
    if (newAppId && newAppId !== currentApplicationId.value) {
        setApplicationId(newAppId);
    }
    if (!currentApplicationId.value && rawMessages.length === 0) {
        messages.value = [];
        isLoading.value = false;
        return;
    }

    isLoading.value = true;
    lastError.value = null;
    await dismissedPromise.value;

    const now = Date.now();
    const newProcessedMessages: ProcessedMessage[] = [];
    const incomingMessageIds = new Set<string>();

    // Process incoming messages
    rawMessages.forEach((rawText, index) => {
      const cleanedText = cleanMessageText(rawText);
      const id = generateMessageId(cleanedText);
      incomingMessageIds.add(id);

      const existingMessage = messages.value.find(m => m.id === id);
      const messageType = categorizeMessage(rawText);

      if (existingMessage) {
        existingMessage.lastSeen = now;
        existingMessage.rawText = rawText;
        existingMessage.cleanedText = cleanedText;
        existingMessage.type = messageType;
        if (!existingMessage.isDismissedOnce) {
        newProcessedMessages.push(existingMessage);
        }

      } else {
        newProcessedMessages.push({
          id,
          rawText,
          cleanedText,
          type: messageType,
          firstSeen: now,
          lastSeen: now,
          isDismissedOnce: false,
          originalIndex: index,
        });
      }
    });

    // **CHANGE**: Identify removed messages based on ID, not raw text
    const removedMessagesCount = messages.value.filter(
      oldMsg => !incomingMessageIds.has(oldMsg.id)
    ).length;
    
    // **KEY CHANGE**: We update the change counters *before* filtering for visibility.
    // This gives a more accurate count of what the API sent vs what is displayed.
    const newVisibleMessages = newProcessedMessages.filter(m => !permanentlyDismissedMessageIds.value.includes(m.id));

    changeCounters.value = {
        newMessages: newVisibleMessages.length, // Count only what will be visible
        removedMessages: removedMessagesCount
    };
    
    // The main `messages` array now holds ALL messages from the last poll.
    messages.value = newProcessedMessages.sort((a,b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
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