<template>
  <div class="messages-display-container">
    <!-- Χρήση localMessageStore αντί για messageStore -->
    <div
      v-if="localMessageStore.isLoading && localMessageStore.messages.length === 0 && localMessageStore.currentApplicationId"
      class="loading-messages"
    >
      Φόρτωση μηνυμάτων...
    </div>
    <div
      v-else-if="!localMessageStore.currentApplicationId"
      class="no-app-id-message"
    >
      Δεν έχει επιλεγεί αίτηση για εμφάνιση μηνυμάτων.
    </div>
    <div
      v-else-if="visibleMessages && visibleMessages.length === 0"
      class="no-messages"
    >
      Δεν υπάρχουν μηνύματα συστήματος για αυτή την αίτηση.
    </div>

    <template v-if="localMessageStore.currentApplicationId && !localMessageStore.isLoading">
      <section v-if="visibleMessages && visibleMessages.length > 0">
        <ul>
          <li v-for="msg in visibleMessages" :key="msg.id">
            <p v-html="formatMessageText(msg.rawText)" ></p>
            <div class="actions">
              <button title="Απόκρυψη για αυτή τη φορά" @click="localMessageStore.dismissMessageOnce(msg.id)">Αγνόηση</button>
              <button title="Μόνιμη απόκρυψη αυτού του μηνύματος" @click="dismissPermanently(msg.id, msg.rawText)">Αγνόηση για πάντα</button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Dismissed messages collapsible -->
      <section class="message-section dismissed">
        <h5 @click="showDismissed = !showDismissed" style="cursor:pointer;">
          <span class="icon">🗑️</span> Απορριφθέντα μηνύματα ({{ dismissedMessages.length }})
          <span class="toggle-icon">{{ showDismissed ? '▼' : '▶' }}</span>
        </h5>
        <ul v-show="showDismissed">
          <li v-for="msg in dismissedMessages" :key="msg.id">
            <p v-html="formatMessageText(msg.rawText)"></p>
            <div class="actions">
              <button title="Επαναφορά μηνύματος" @click="restoreDismissed(msg.id)">Επαναφορά</button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
  
<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessageStore } from '../stores/messages.store';
import { sendMessage } from 'webext-bridge/content-script';
import type { ProcessedMessage } from '../stores/messages.store';

const props = defineProps<{ messages?: ProcessedMessage[], visibleMessages?: ProcessedMessage[] }>();
console.info('MessagesDisplay props', props);
const localMessageStore = useMessageStore(); // Χρήση του τοπικού store
const visibleMessages = computed(() => {
  if (props.visibleMessages) return props.visibleMessages;
  return localMessageStore.visibleMessages;
});
// const errorMessages = computed(() => {
//   if (props.messages) return props.messages.filter(m => m.type === 'Error');
//   return localMessageStore.errorMessages;
// });
// const warningMessages = computed(() => {
//   if (props.messages) return props.messages.filter(m => m.type === 'Warning');
//   return localMessageStore.warningMessages;
// });
// const infoMessages = computed(() => {
//   if (props.messages) return props.messages.filter(m => m.type === 'Info');
//   return localMessageStore.infoMessages;
// });

const dismissedMessages = computed(() => {
  // Show all permanently dismissed messages for the current app
  const dismissedIds = localMessageStore.permanentlyDismissedMessageIds;
  // Find all messages that are dismissed
  return dismissedIds.map(id => {
    // Try to find the original message (for text/type)
    return props.messages?.find(m => m.id === id);
  });
});

const showDismissed = ref(false);

const dismissPermanently = (messageId: string, rawText: string) => {
  if (confirm(`Είστε σίγουροι ότι θέλετε να αγνοήσετε μόνιμα το μήνυμα:\n"${cleanMessageText(rawText)}";`)) {
    localMessageStore.dismissMessagePermanently(messageId);
    sendMessage('dismiss-message-permanently', { messageId }).catch((e: unknown) => console.warn("CS: Failed to send dismiss-permanently", e));
  }
};
const restoreDismissed = (messageId: string) => {
  localMessageStore.restoreDismissedMessage(messageId);
  // Optionally notify background if needed
};

// Για να κάνουμε bold τα keywords μέσα στα μηνύματα (προαιρετικό)
function formatMessageText(text: string): string {
    const keywords = ["πρέπει να", "δεν επιτρέπεται", "ενημερωτικό μήνυμα"];
    let formattedText = text;
    keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        formattedText = formattedText.replace(regex, '<strong>$1</strong>');
    });
    return formattedText;
}
function cleanMessageText(rawText: string): string {
  return rawText.replace(/\s*\((?:Α\/Α [^:]+:|A\/A [^:]+:)\s*[^)]+\)$/, '').trim();
}
</script>
  
<style scoped>
.messages-display-container {
  padding: 10px; /* Περιθώριο γύρω από όλο το περιεχόμενο */
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
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
  font-size: 1em; /* 14px base */
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

.message-section h5.collapsed .toggle-icon {
  transform: rotate(-90deg);
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
  max-height: 200px; /* Περιορισμός ύψους για scroll αν χρειαστεί */
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
  font-size: 0.9em; /* 12.6px */
  line-height: 1.45;
  word-break: break-word;
}
.message-section li small {
  font-size: 0.8em; /* 11.2px */
  color: #757575;
  display: block;
}



.actions {
    margin-top: 6px;
}
.actions button {
  font-size: 0.8em; /* 11.2px */
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