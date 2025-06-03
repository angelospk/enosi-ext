import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';

export interface ProcessedMessage {
  id: string; // Μοναδικό ID, π.χ. hash του rawText
  rawText: string;
  cleanedText: string; // Κείμενο χωρίς το (Α/Α...)
  type: 'Error' | 'Warning' | 'Info';
<<<<<<< Updated upstream
  relatedItemIds: string[]; // IDs από το (Α/Α...)
=======
>>>>>>> Stashed changes
  firstSeen: number; // Timestamp
  lastSeen: number;  // Timestamp
  isDismissedOnce?: boolean; // Για απόρριψη στην τρέχουσα συνεδρία
  originalIndex?: number; // Για διατήρηση σειράς από το API
}

// Βοηθητική συνάρτηση για τη δημιουργία ενός απλού hash ID για τα μηνύματα
function generateMessageId(rawText: string): string {
  let hash = 0;
  for (let i = 0; i < rawText.length; i++) {
    const char = rawText.charCodeAt(i);
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

function extractRelatedIds(text: string): string[] {
  const match = text.match(/\((?:Α\/Α [^:]+:|A\/A [^:]+:)\s*([^)]+)\)/);
  if (match && match[1]) {
    return match[1].split(',').map(id => id.trim()).filter(id => id.length > 0);
  }
  return [];
}

function cleanMessageText(rawText: string): string {
  return rawText.replace(/\s*\((?:Α\/Α [^:]+:|A\/A [^:]+:)\s*[^)]+\)$/, '').trim();
}

export const useMessageStore = defineStore('messages', () => {
  const currentApplicationId = ref<string | null>(null);
  const messages = ref<ProcessedMessage[]>([]);
  const { data: permanentlyDismissedMessageIds, promise: dismissedPromise } =
    useBrowserLocalStorage<string[]>('permanentlyDismissedSystemMessages', []);

  const isLoading = ref(false);
  const lastError = ref<string | null>(null);

  // Για το badge στο εικονίδιο
  const changeCounters = ref<{ newErrors: number, newWarnings: number, newInfos: number, removedMessages: number }>({
    newErrors: 0,
    newWarnings: 0,
    newInfos: 0,
    removedMessages: 0
  });

  function setApplicationId(appId: string | null) {
    if (currentApplicationId.value !== appId) {
      console.log(`[MessageStore] Application ID changing from '${currentApplicationId.value}' to '${appId}'`);
      currentApplicationId.value = appId;
      messages.value = []; // Καθαρισμός μηνυμάτων για την παλιά αίτηση
      // Επαναφορά των "dismissedOnce" αν είχαμε τέτοια λογική για session
      changeCounters.value = { newErrors: 0, newWarnings: 0, newInfos: 0, removedMessages: 0 }; // Reset counters
      if (!appId) {
          isLoading.value = false;
      }
    }
  }

  async function updateMessages(rawMessages: string[], newAppId?: string) {
    if (newAppId && newAppId !== currentApplicationId.value) {
        // Αυτό δεν θα έπρεπε να συμβεί αν το setApplicationId καλείται πρώτα
        console.warn("[MessageStore] updateMessages called with a new AppId, but currentApplicationId wasn't set. Syncing.")
        setApplicationId(newAppId);
    }
    if (!currentApplicationId.value && rawMessages.length === 0) {
        messages.value = [];
        isLoading.value = false;
        return;
    }


    isLoading.value = true;
    lastError.value = null;
    await dismissedPromise.value; // Βεβαιωθείτε ότι τα απορριφθέντα IDs έχουν φορτωθεί

    const now = Date.now();
    const newProcessedMessages: ProcessedMessage[] = [];
    const incomingMessageTextSet = new Set<string>(rawMessages); // Για γρήγορο έλεγχο ύπαρξης

    let newErrorCount = 0;
    let newWarningCount = 0;
    let newInfoCount = 0;

    // Επεξεργασία εισερχόμενων μηνυμάτων
    rawMessages.forEach((rawText, index) => {
      const id = generateMessageId(rawText); // Βασισμένο στο περιεχόμενο

      if (permanentlyDismissedMessageIds.value.includes(id)) {
        return; // Παράλειψη όσων έχουν απορριφθεί μόνιμα
      }

      const existingMessage = messages.value.find(m => m.id === id);
      const messageType = categorizeMessage(rawText);

      if (existingMessage) {
        // Ενημέρωση υπάρχοντος μηνύματος
        existingMessage.lastSeen = now;
        existingMessage.rawText = rawText; // Ενημέρωση κειμένου αν έχει αλλάξει ελαφρώς
        existingMessage.cleanedText = cleanMessageText(rawText);
        existingMessage.type = messageType; // Επαν-κατηγοριοποίηση
        existingMessage.relatedItemIds = extractRelatedIds(rawText);
        existingMessage.isDismissedOnce = false; // Επαναφορά απόρριψης συνεδρίας
        newProcessedMessages.push(existingMessage);
      } else {
        // Νέο μήνυμα
        newProcessedMessages.push({
          id,
          rawText,
          cleanedText: cleanMessageText(rawText),
          type: messageType,
          relatedItemIds: extractRelatedIds(rawText),
          firstSeen: now,
          lastSeen: now,
          isDismissedOnce: false,
          originalIndex: index,
        });
        if (messageType === 'Error') newErrorCount++;
        else if (messageType === 'Warning') newWarningCount++;
        else if (messageType === 'Info') newInfoCount++;
      }
    });

    // Εντοπισμός αφαιρεμένων μηνυμάτων
    const removedMessagesCount = messages.value.filter(
      oldMsg => !incomingMessageTextSet.has(oldMsg.rawText) && !permanentlyDismissedMessageIds.value.includes(oldMsg.id)
    ).length;

    changeCounters.value = {
        newErrors: newErrorCount,
        newWarnings: newWarningCount,
        newInfos: newInfoCount,
        removedMessages: removedMessagesCount
    };

    messages.value = newProcessedMessages.sort((a,b) => (a.originalIndex ?? 0) - (b.originalIndex ?? 0));
    isLoading.value = false;
    // console.log('[MessageStore] Messages updated:', messages.value.length, 'Change Counters:', changeCounters.value);
  }

  function dismissMessageOnce(messageId: string) {
    const message = messages.value.find(m => m.id === messageId);
    if (message) {
      message.isDismissedOnce = true;
      // Για να μην εμφανίζεται άμεσα η αλλαγή στο badge, καθώς είναι απλή απόρριψη
    }
  }

  async function dismissMessagePermanently(messageId: string) {
    await dismissedPromise.value;
    if (!permanentlyDismissedMessageIds.value.includes(messageId)) {
      permanentlyDismissedMessageIds.value.push(messageId);
      // Το useBrowserLocalStorage θα αποθηκεύσει αυτόματα την αλλαγή
    }
    // Αφαίρεση από την τρέχουσα προβολή
    messages.value = messages.value.filter(m => m.id !== messageId);
  }

  const visibleMessages = computed(() => {
    return messages.value.filter(
      m => !m.isDismissedOnce && !permanentlyDismissedMessageIds.value.includes(m.id)
    );
  });

  const errorMessages = computed(() => visibleMessages.value.filter(m => m.type === 'Error'));
  const warningMessages = computed(() => visibleMessages.value.filter(m => m.type === 'Warning'));
  const infoMessages = computed(() => visibleMessages.value.filter(m => m.type === 'Info'));

  function clearChangeCounters() {
    changeCounters.value = { newErrors: 0, newWarnings: 0, newInfos: 0, removedMessages: 0 };
  }

  return {
    currentApplicationId,
    messages, // Η πλήρης λίστα των επεξεργασμένων (μη μόνιμα απορριφθέντων) μηνυμάτων
    permanentlyDismissedMessageIds,
    isLoading,
    lastError,
    changeCounters,
    errorMessages, // Ορατά σφάλματα
    warningMessages, // Ορατές προειδοποιήσεις
    infoMessages, // Ορατά ενημερωτικά
    setApplicationId,
    updateMessages,
    dismissMessageOnce,
    dismissMessagePermanently,
    clearChangeCounters,
  };
});