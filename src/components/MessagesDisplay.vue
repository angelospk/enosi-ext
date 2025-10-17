<template>
  <div class="messages-display-container">
    <!-- Filter Input -->
    <div class="filter-wrapper">
      <input
        v-model="filterQuery"
        type="text"
        placeholder="Φιλτράρισμα μηνυμάτων..."
        class="filter-input"
      >
    </div>

    <!-- UI relies directly on the store's state -->
    <div
      v-if="messageStore.isLoading && messageStore.messages.length === 0 && messageStore.currentApplicationId"
      class="loading-messages"
    >
      Φόρτωση μηνυμάτων...
    </div>
    <div
      v-else-if="!messageStore.currentApplicationId"
      class="no-app-id-message"
    >
      Δεν έχει επιλεγεί αίτηση για εμφάνιση μηνυμάτων.
    </div>
    <div
      v-else-if="filteredMessages.length === 0 && permanentlyDismissedMessages.length === 0"
      class="no-messages"
    >
      Δεν υπάρχουν μηνύματα συστήματος για αυτή την αίτηση.
    </div>

    <template v-if="messageStore.currentApplicationId">
      <!-- Section for Visible Messages -->
      <section v-if="filteredMessages.length > 0">
        <ul>
          <li
            v-for="msg in filteredMessages"
            :key="msg.id"
          >
            <p v-html="formatMessageText(msg.rawText)"></p>
            <div class="actions">
              <button
                title="Απόκρυψη για αυτή τη φορά"
                @click="messageStore.dismissMessageOnce(msg.id)"
              >
                Αγνόηση
              </button>
              <button
                title="Μόνιμη απόκρυψη αυτού του μηνύματος"
                @click="dismissPermanently(msg)"
              >
                Αγνόηση για πάντα
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Section for Permanently Dismissed Messages -->
      <section
        v-if="permanentlyDismissedMessages.length > 0"
        class="message-section dismissed"
      >
        <h5
          style="cursor:pointer;"
          @click="showDismissed = !showDismissed"
        >
          <span class="icon">🗑️</span> Απορριφθέντα μηνύματα ({{ permanentlyDismissedMessages.length }})
          <span class="toggle-icon">{{ showDismissed ? '▼' : '▶' }}</span>
        </h5>
        <ul v-show="showDismissed">
          <li
            v-for="msg in permanentlyDismissedMessages"
            :key="msg.id"
          >
            <p v-html="formatMessageText(msg.rawText)"></p>
            <div class="actions">
              <button
                title="Επαναφορά μηνύματος"
                @click="restoreDismissed(msg.id)"
              >
                Επαναφορά
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
  
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessageStore, type ProcessedMessage } from '../stores/messages.store';
import { sendMessage } from 'webext-bridge/content-script';

// **REMOVED**: No more props. The component gets all its data from the store.
// const props = defineProps<{ messages?: ProcessedMessage[] }>();

// Use the store as the single source of truth
const messageStore = useMessageStore();

// --- NEW: Filter Logic ---
const filterQuery = ref('');
const filteredMessages = computed(() => {
  if (!filterQuery.value) {
    return messageStore.visibleMessages;
  }
  const lowerCaseQuery = filterQuery.value.toLowerCase();
  return messageStore.visibleMessages.filter(msg =>
    msg.rawText.toLowerCase().includes(lowerCaseQuery)
  );
});
// --- End of Filter Logic ---

// **SIMPLIFIED**: These computed properties now directly use the store's computed properties.
// No more complex local logic.
const permanentlyDismissedMessages = computed(() => messageStore.permanentlyDismissedMessages);

const showDismissed = ref(false);

// **SIMPLIFIED**: We pass the whole message object now, which is cleaner.
const dismissPermanently = (message: ProcessedMessage) => {
  if (confirm(`Είστε σίγουροι ότι θέλετε να αγνοήσετε μόνιμα το μήνυμα:\n"${message.cleanedText}";`)) {
    messageStore.dismissMessagePermanently(message.id);
    // Optional: Send message to background script
    sendMessage('dismiss-message-permanently', { messageId: message.id }).catch((e: unknown) => console.warn("CS: Failed to send dismiss-permanently", e));
  }
};

const restoreDismissed = (messageId: string) => {
  messageStore.restoreDismissedMessage(messageId);
  // The UI will update instantly because of the store's reactivity.
};

// Helper function to format text (no changes needed)
function formatMessageText(text: string): string {
    const keywords = ["πρέπει να", "δεν επιτρέπεται", "ενημερωτικό μήνυμα"];
    let formattedText = text;
    keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        formattedText = formattedText.replace(regex, '<strong>$1</strong>');
    });
    return formattedText;
}
</script>
  
<style scoped>
/* Your CSS remains the same, it's already well-structured. */
.messages-display-container {
  padding: 10px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
.filter-wrapper {
  margin-bottom: 10px;
}
.filter-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
  font-size: 0.9em;
}
.loading-messages, .no-app-id-message, .no-messages {
  color: #555;
  padding: 20px;
  text-align: center;
  font-style: italic;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.message-section {
  margin-bottom: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 5px;
  background-color: #fff;
}
.message-section:last-child {
  margin-bottom: 0;
}

.message-section h5 {
  padding: 10px 12px;
  margin: 0;
  cursor: pointer;
  font-size: 1em;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e0e0e0;
  user-select: none;
}
.message-section h5 .icon {
    margin-right: 8px;
    font-size: 1.1em;
}

.toggle-icon {
  transition: transform 0.15s ease-in-out;
  display: inline-block;
  font-size: 0.8em;
  color: #555;
}

.message-section ul {
  list-style-type: none;
  padding: 5px 12px 10px 12px;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}
.message-section li {
  padding: 8px 0;
  border-bottom: 1px dotted #efefef;
}
.message-section li:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.message-section li p {
  margin: 0 0 6px 0;
  font-size: 0.9em;
  line-height: 1.45;
  word-break: break-word;
}

.actions {
    margin-top: 6px;
}
.actions button {
  font-size: 0.8em;
  padding: 3px 7px;
  margin-right: 8px;
  cursor: pointer;
  border: 1px solid #ccc;
  background-color: #f7f7f7;
  border-radius: 3px;
  color: #333;
}
.actions button:hover {
  background-color: #e8e8e8;
  border-color: #bbb;
}
</style>