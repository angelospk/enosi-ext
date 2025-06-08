<template>
  <div
    v-if="isVisible"
    ref="popupEl"
    class="persistent-icon-popup-content"
    :style="{
      top: state.y + 'px',
      left: state.x + 'px',
      width: state.width + 'px',
      height: state.height + 'px',
    }"
  >
    <!-- 1. ΝΕΟ: Banner που εμφανίζεται όταν υπάρχουν νέες αλλαγές (προσθήκες/αφαιρέσεις) -->
    <div
      v-if="showUpdateBanner"
      class="popup-update-banner"
      @click="clearChangeCounters"
    >
      {{ bannerText }} (κάντε κλικ για εκκαθάριση)
    </div>

    <!-- 2. Header με τις καρτέλες (tabs) και το κουμπί κλεισίματος -->
    <div
      class="popup-header"
      @mousedown.prevent="handleDragStart"
    >
      <div class="tab-buttons">
        <button
          :class="{ active: activeTab === 'messages' }"
          @click="activeTab = 'messages'"
        >
          Μηνύματα ({{ messageStore.visibleMessages.length }})
        </button>
        <button
          :class="{ active: activeTab === 'lastYear' }"
          @click="activeTab = 'lastYear'"
        >
          Περσινά
        </button>
        <button
          :class="{ active: activeTab === 'totals' }"
          @click="activeTab = 'totals'"
          disabled
          title="Σύντομα διαθέσιμο"
        >
          Συνολικά
        </button>
        <button
          :class="{ active: activeTab === 'afm' }"
          @click="activeTab = 'afm'"
          disabled
          title="Σύντομα διαθέσιμο"
        >
          AFM
        </button>
        <button
          :class="{ active: activeTab === 'settings' }"
          @click="activeTab = 'settings'"
        >
          Ρυθμίσεις
        </button>
      </div>
      <button
        class="close-button"
        title="Κλείσιμο"
        @click.stop="closePopupAndClearBadge"
      >
        ×
      </button>
    </div>

    <!-- 3. Κύριο περιεχόμενο που αλλάζει ανάλογα με την ενεργή καρτέλα -->
    <div class="popup-body">
      <!-- Περιεχόμενο για την καρτέλα "Μηνύματα" -->
      <template v-if="activeTab === 'messages'">
        <!-- Το MessagesDisplay δεν χρειάζεται πια props, παίρνει τα δεδομένα από το store του -->
        <MessagesDisplay />
      </template>

      <!-- Περιεχόμενο για την καρτέλα "Περσινά Στοιχεία" -->
      <template v-if="activeTab === 'lastYear'">
        <LastYearDataCard />
      </template>

      <!-- Placeholder for Totals Tab -->
      <template v-if="activeTab === 'totals'">
        <div class="placeholder-pane">
          <h4>Συνολικά Στοιχεία Αίτησης</h4>
          <p>Αυτή η λειτουργία θα είναι σύντομα διαθέσιμη.</p>
        </div>
      </template>

      <!-- Placeholder for AFM Tab -->
      <template v-if="activeTab === 'afm'">
        <div class="placeholder-pane">
          <h4>Διαχείριση Λεξικού ΑΦΜ</h4>
          <p>Αυτή η λειτουργία θα είναι σύντομα διαθέσιμη.</p>
        </div>
      </template>

      <!-- Περιεχόμενο για την καρτέλα "Ρυθμίσεις" -->
      <template v-if="activeTab === 'settings'">
        <div class="settings-pane">
          <h4>Ρυθμίσεις Polling</h4>
          <div class="setting-item">
            <label>
              <input
                v-model="settingsStore.pollingEnabled"
                type="checkbox"
              />
              Αυτόματη Ανανέωση
            </label>
          </div>
          <div class="setting-item">
            <label for="polling-interval">Διάστημα (δευτερόλεπτα):</label>
            <input
              id="polling-interval"
              v-model.number="pollingIntervalSeconds"
              type="number"
              min="2"
              step="1"
              style="width: 70px;"
              :disabled="!settingsStore.pollingEnabled"
            />
          </div>
          <hr>
          <h4>Άλλες Ρυθμίσεις</h4>
          <div class="setting-item-vertical">
            <label>
              <input
                v-model="settingsStore.restoreDismissedOnNewApp"
                type="checkbox"
              />
              Επαναφορά απορριφθέντων σε νέα αίτηση
            </label>
            <small>Όλα τα "αγνοημένα για πάντα" μηνύματα θα εμφανιστούν ξανά όταν επιλέξετε διαφορετική αίτηση.</small>
          </div>
        </div>
      </template>
    </div>

    <!-- 4. Χειριστήρια για αλλαγή μεγέθους (παραμένουν ως είχαν) -->
    <div
      class="resize-handle resize-handle-br"
      @mousedown.prevent="handleResizeStart($event, 'br')"
    ></div>
    <div
      class="resize-handle resize-handle-r"
      @mousedown.prevent="handleResizeStart($event, 'r')"
    ></div>
    <div
      class="resize-handle resize-handle-b"
      @mousedown.prevent="handleResizeStart($event, 'b')"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';
import MessagesDisplay from './MessagesDisplay.vue';
import LastYearDataCard from './LastYearDataCard.vue';
import { useMessageStore } from '../stores/messages.store';
import { useSettingsStore } from '../stores/settings.store'; // Νέα εισαγωγή
import { sendMessage, onMessage } from 'webext-bridge/content-script';

interface PopupState {
  x: number;
  y: number;
  width: number;
  height: number;
}

// --- State για την κατάσταση του Component ---
const isVisible = ref(false);
const activeTab = ref<'messages' | 'settings' | 'lastYear' | 'totals' | 'afm'>('messages');

// --- Pinia Stores ---
const messageStore = useMessageStore();
const settingsStore = useSettingsStore();

// Listen for application ID changes from the background script and update the message store
onMessage('application-id-changed', (message) => {
  const newAppId = message.data as string | null;
  messageStore.setApplicationId(newAppId);
});

// --- Λογική για το Banner Ενημερώσεων ---
const showUpdateBanner = computed(() => {
  const totalNew = messageStore.changeCounters.newErrors + messageStore.changeCounters.newWarnings + messageStore.changeCounters.newInfos;
  return totalNew > 0 || messageStore.changeCounters.removedMessages > 0;
});

const bannerText = computed(() => {
  const parts = [];
  const totalNew = messageStore.changeCounters.newErrors + messageStore.changeCounters.newWarnings + messageStore.changeCounters.newInfos;
  if (totalNew > 0) {
    parts.push(`${totalNew} νέα`);
  }
  if (messageStore.changeCounters.removedMessages > 0) {
    parts.push(`${messageStore.changeCounters.removedMessages} αφαιρέθηκαν`);
  }
  return `${parts.join(', ')}`;
});

const clearChangeCounters = () => {
  messageStore.clearChangeCounters();
  sendMessage('clear-change-counters', null).catch(e => console.warn("CS: Failed to send clear-change-counters", e));
};

// --- Λογική για το Polling (τώρα συνδέεται με το settingsStore) ---
// Computed property για μετατροπή ms <-> δευτερόλεπτα για το UI
const pollingIntervalSeconds = computed({
  get: () => Math.round(settingsStore.pollingInterval / 1000),
  set: (value) => {
    // Ενημέρωση του store σε milliseconds όταν ο χρήστης αλλάζει την τιμή
    if (typeof value === 'number' && value >= 2) {
      settingsStore.pollingInterval = value * 1000;
    }
  }
});

// --- Λογική για την Εμφάνιση/Απόκρυψη του Popup ---
const show = () => {
  isVisible.value = true;
  nextTick(() => {
    ensureInViewport();
  });
};

const hide = () => {
  isVisible.value = false;
};

const closePopupAndClearBadge = () => {
    hide();
    clearChangeCounters();
    sendMessage('popup-visibility-changed', { visible: false }).catch(e => console.warn("CS: Failed to send popup-visibility-changed", e));
}

const toggleVisibility = () => {
  if (isVisible.value) {
    closePopupAndClearBadge();
  } else {
    show();
    clearChangeCounters(); // Καθαρισμός μετρητών μόλις ανοίξει
    sendMessage('popup-visibility-changed', { visible: true }).catch(e => console.warn("CS: Failed to send popup-visibility-changed", e));
  }
};

// Expose μεθόδων για να καλούνται από το εξωτερικό (π.χ. από το content script)
defineExpose({ show, hide, toggleVisibility, isVisible });

// --- Λογική για Μετακίνηση & Αλλαγή Μεγέθους (Drag & Resize) ---
// (Αυτή η ενότητα παραμένει ακριβώς όπως την είχες)
const popupEl = ref<HTMLElement | null>(null);
const operation = ref<'idle' | 'dragging' | 'resizing'>('idle');
const dragStartPos = ref({ x: 0, y: 0 });
const initialPopupState = ref<PopupState | null>(null);
const activeResizeHandle = ref<string | null>(null);

const defaultState: PopupState = {
  x: window.innerWidth - 380,
  y: 60,
  width: 360,
  height: 450,
};
const minWidth = 250;
const minHeight = 200;

const { data: state, promise: statePromise } = useBrowserLocalStorage<PopupState>(
  'persistentPopupState',
  { ...defaultState }
);

onMounted(async () => {
  await statePromise;
  if (state.value.width < minWidth) state.value.width = defaultState.width;
  if (state.value.height < minHeight) state.value.height = defaultState.height;
  ensureInViewport();
});

const ensureInViewport = () => {
    let newX = state.value.x;
    let newY = state.value.y;
    const currentWidth = state.value.width;
    const currentHeight = state.value.height;

    if (newX + currentWidth > window.innerWidth) newX = window.innerWidth - currentWidth - 5;
    if (newY + currentHeight > window.innerHeight) newY = window.innerHeight - currentHeight - 5;
    if (newX < 0) newX = 5;
    if (newY < 0) newY = 5;

    state.value.x = newX;
    state.value.y = newY;
};

const handleDragStart = (event: MouseEvent) => {
  if (operation.value !== 'idle') return;
  operation.value = 'dragging';
  initialPopupState.value = { ...state.value };
  dragStartPos.value = { x: event.clientX, y: event.clientY };
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.userSelect = 'none';
};

const handleResizeStart = (event: MouseEvent, handle: string) => {
  if (operation.value !== 'idle') return;
  operation.value = 'resizing';
  activeResizeHandle.value = handle;
  initialPopupState.value = { ...state.value };
  dragStartPos.value = { x: event.clientX, y: event.clientY };
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.userSelect = 'none';
};

const handleMouseMove = (event: MouseEvent) => {
  if (operation.value === 'idle' || !initialPopupState.value) return;
  event.preventDefault();

  const dx = event.clientX - dragStartPos.value.x;
  const dy = event.clientY - dragStartPos.value.y;

  if (operation.value === 'dragging') {
    state.value.x = initialPopupState.value.x + dx;
    state.value.y = initialPopupState.value.y + dy;
  } else if (operation.value === 'resizing' && activeResizeHandle.value) {
    let newWidth = initialPopupState.value.width;
    let newHeight = initialPopupState.value.height;
    if (activeResizeHandle.value.includes('r')) newWidth = Math.max(minWidth, initialPopupState.value.width + dx);
    if (activeResizeHandle.value.includes('b')) newHeight = Math.max(minHeight, initialPopupState.value.height + dy);
    state.value.width = newWidth;
    state.value.height = newHeight;
  }
};

const handleMouseUp = () => {
  if (operation.value === 'idle') return;
  ensureInViewport(); // Βεβαιώνει ότι το παράθυρο είναι ορατό μετά το drag/resize
  operation.value = 'idle';
  activeResizeHandle.value = null;
  initialPopupState.value = null;
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.body.style.userSelect = '';
};

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  if (document.body.style.userSelect === 'none') {
    document.body.style.userSelect = '';
  }
});
</script>

<style scoped>
.persistent-icon-popup-content {
  position: fixed;
  background-color: white;
  border: 1px solid #ccc;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  z-index: 2147483645;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* Κρύβει οτιδήποτε ξεφεύγει από τις στρογγυλεμένες γωνίες */
}

.popup-header {
  background-color: #f0f0f0;
  padding: 0 12px 0 0; /* Αλλαγή padding για να χωρέσουν οι καρτέλες */
  cursor: move;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 40px; /* Λίγο μεγαλύτερο ύψος για τις καρτέλες */
  box-sizing: border-box;
  flex-shrink: 0;
}

.close-button {
  background: none;
  border: none;
  font-size: 22px;
  font-weight: bold;
  color: #777;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
}
.close-button:hover {
  color: #333;
}

/* Στυλ για τις Καρτέλες (Tabs) */
.tab-buttons {
  display: flex;
  align-self: flex-end;
}
.tab-buttons button {
  padding: 8px 16px;
  border: none;
  background-color: transparent;
  cursor: pointer;
  font-size: 0.9em;
  font-weight: 500;
  color: #555;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px; /* Για να "κάθεται" πάνω στη γραμμή του header */
  transition: background-color 0.2s;
}
.tab-buttons button.active {
  color: #007bff;
  font-weight: 600;
  border-bottom-color: #007bff;
}
.tab-buttons button:hover:not(.active) {
  background-color: #e9e9e9;
}

.popup-body {
  color: #555;
  flex-grow: 1;
  overflow-y: auto;
  font-size: 14px;
  min-height: 0;
}

/* Στυλ για το Banner Ενημερώσεων */
.popup-update-banner {
  background: #e3f2fd;
  color: #0d47a1;
  padding: 8px 12px;
  text-align: center;
  font-weight: bold;
  cursor: pointer;
  border-bottom: 1px solid #90caf9;
  flex-shrink: 0;
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Στυλ για την Καρτέλα Ρυθμίσεων */
.settings-pane {
  padding: 15px;
  font-size: 14px;
}
.settings-pane h4 {
  margin-top: 0;
  margin-bottom: 10px;
  border-bottom: 1px solid #eee;
  padding-bottom: 5px;
  color: #333;
}
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.setting-item-vertical {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 12px;
}
.setting-item label, .setting-item-vertical label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}
.setting-item-vertical small {
  display: block;
  color: #666;
  margin-top: 4px;
  font-size: 0.85em;
  padding-left: 24px;
}
hr {
  border: none;
  border-top: 1px solid #eee;
  margin: 20px 0;
}

/* Στυλ για τα Χερούλια Αλλαγής Μεγέθους (Resize Handles) */
.resize-handle {
  position: absolute;
}
.resize-handle-br {
  bottom: 0;
  right: 0;
  width: 15px;
  height: 15px;
  cursor: nwse-resize;
}
.resize-handle-r {
  top: 0;
  right: 0;
  width: 5px;
  height: 100%;
  cursor: ew-resize;
}
.resize-handle-b {
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5px;
  cursor: ns-resize;
}
</style>