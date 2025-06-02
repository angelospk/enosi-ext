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
      v-else-if="!localMessageStore.isLoading && errorMessages.length === 0 && warningMessages.length === 0 && infoMessages.length === 0"
      class="no-messages"
    >
      Δεν υπάρχουν μηνύματα συστήματος για αυτή την αίτηση.
    </div>

    <template v-if="localMessageStore.currentApplicationId && !localMessageStore.isLoading">
      <section
        v-if="errorMessages.length > 0"
        class="message-section errors"
      >
        <h5
          :class="{ collapsed: collapsedSections.errors }"
          @click="toggleCollapse('errors')"
        >
          <span class="icon">❗</span> Σφάλματα ({{ errorMessages.length }})
          <span class="toggle-icon">{{ collapsedSections.errors ? '▶' : '▼' }}</span>
        </h5>
        <ul v-show="!collapsedSections.errors">
          <li
            v-for="msg in errorMessages"
            :key="msg.id"
          >
            <p v-html="formatMessageText(msg.cleanedText)"></p>
            <small v-if="msg.relatedItemIds.length">Αφορά: {{ msg.relatedItemIds.join(', ') }}</small>
            <!-- Δεν υπάρχει επιλογή απόρριψης για τα errors -->
          </li>
        </ul>
      </section>

      <section
        v-if="warningMessages.length > 0"
        class="message-section warnings"
      >
        <h5
          :class="{ collapsed: collapsedSections.warnings }"
          @click="toggleCollapse('warnings')"
        >
          <span class="icon">⚠️</span> Προειδοποιήσεις ({{ warningMessages.length }})
          <span class="toggle-icon">{{ collapsedSections.warnings ? '▶' : '▼' }}</span>
        </h5>
        <ul v-show="!collapsedSections.warnings">
          <li
            v-for="msg in warningMessages"
            :key="msg.id"
          >
            <p v-html="formatMessageText(msg.cleanedText)"></p>
            <small v-if="msg.relatedItemIds.length">Αφορά: {{ msg.relatedItemIds.join(', ') }}</small>
            <div class="actions">
              <button
                title="Απόκρυψη για αυτή τη φορά"
                @click="localMessageStore.dismissMessageOnce(msg.id)"
              >
                Αγνόηση
              </button>
              <button
                title="Μόνιμη απόκρυψη αυτού του μηνύματος"
                @click="dismissPermanently(msg.id, msg.rawText)"
              >
                Αγνόηση για πάντα
              </button>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="infoMessages.length > 0"
        class="message-section info"
      >
        <h5
          :class="{ collapsed: collapsedSections.info }"
          @click="toggleCollapse('info')"
        >
          <span class="icon">ℹ️</span> Ενημερωτικά ({{ infoMessages.length }})
          <span class="toggle-icon">{{ collapsedSections.info ? '▶' : '▼' }}</span>
        </h5>
        <ul v-show="!collapsedSections.info">
          <li
            v-for="msg in infoMessages"
            :key="msg.id"
          >
            <p v-html="formatMessageText(msg.cleanedText)"></p>
            <small v-if="msg.relatedItemIds.length">Αφορά: {{ msg.relatedItemIds.join(', ') }}</small>
            <div class="actions">
              <button
                title="Απόκρυψη για αυτή τη φορά"
                @click="localMessageStore.dismissMessageOnce(msg.id)"
              >
                Αγνόηση
              </button>
              <button
                title="Μόνιμη απόκρυψη αυτού του μηνύματος"
                @click="dismissPermanently(msg.id, msg.rawText)"
              >
                Αγνόηση για πάντα
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
  
  <script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { useMessageStore } from '../stores/messages.store';
  import { sendMessage } from 'webext-bridge/content-script';

  const localMessageStore = useMessageStore(); // Χρήση του τοπικού store

  const errorMessages = computed(() => localMessageStore.errorMessages);
  const warningMessages = computed(() => localMessageStore.warningMessages);
  const infoMessages = computed(() => localMessageStore.infoMessages);
  
  const collapsedSections = ref({
    errors: false, // Τα σφάλματα συνήθως ξεκινούν ανοιχτά
    warnings: true,
    info: true,
  });
  
  const toggleCollapse = (section: keyof typeof collapsedSections.value) => {
    collapsedSections.value[section] = !collapsedSections.value[section];
  };
  
  const dismissOnce = (messageId: string) => {
    // Ενημέρωση τοπικού UI άμεσα για καλύτερη απόκριση
    localMessageStore.dismissMessageOnce(messageId);
    // Αποστολή εντολής στο background
    sendMessage('dismiss-message-once', { messageId }).catch((e: unknown) => console.warn("CS: Failed to send dismiss-once", e));
  };

  const dismissPermanently = (messageId: string, rawText: string) => {
    if (confirm(`Είστε σίγουροι ότι θέλετε να αγνοήσετε μόνιμα το μήνυμα:\n"${cleanMessageText(rawText)}";`)) {
        localMessageStore.dismissMessagePermanently(messageId); // Για άμεση απόκριση στο UI
        sendMessage('dismiss-message-permanently', { messageId }).catch((e: unknown) => console.warn("CS: Failed to send dismiss-permanently", e));
    }
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
  
  // Επαναφορά των collapsed sections όταν αλλάζει το ID της αίτησης
  watch(() => localMessageStore.currentApplicationId, () => {
  collapsedSections.value = {
    errors: localMessageStore.errorMessages.length === 0,
    warnings: true,
    info: true,
  };
   // Άνοιξε αυτόματα την ενότητα σφαλμάτων αν υπάρχουν νέα σφάλματα
  if (localMessageStore.errorMessages.length > 0) {
      collapsedSections.value.errors = false;
    }
  
  });
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
  
  .errors h5 { background-color: #ffebee; color: #c62828; border-left: 4px solid #d32f2f;}
  /* .errors li p { color: #c62828; } */
  
  .warnings h5 { background-color: #fff8e1; color: #ef6c00; border-left: 4px solid #ffa000;}
  /* .warnings li p { color: #ef6c00; } */
  
  .info h5 { background-color: #e3f2fd; color: #1565c0; border-left: 4px solid #1976d2;}
  /* .info li p { color: #1565c0; } */
  
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