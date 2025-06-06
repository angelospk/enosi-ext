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
    <div v-if="showErrorBanner" class="popup-error-banner" @click="clearChangeCounters">
      Νέα σφάλματα: {{ localMessageStore.changeCounters.newErrors }} (κάντε κλικ για εκκαθάριση)
    </div>
    <div
      class="popup-header"
      @mousedown.prevent="handleDragStart"
    >
      <h4>Μηνύματα Αίτησης</h4>
      <div class="polling-controls">
        <label style="margin-right:8px; font-size:0.95em;">
          <input type="checkbox" v-model="pollingEnabled" @change="onPollingToggle" />
          Polling
        </label>
        <input type="number" min="2000" step="1000" v-model.number="pollingInterval" @change="onIntervalChange" style="width:70px; font-size:0.95em;" :disabled="!pollingEnabled" />
        <span style="font-size:0.9em; color:#888; margin-left:4px;">ms</span>
      </div>
      <button
        class="close-button"
        title="Close"
        @click.stop="closePopupAndClearBadge"
      >
        ×
      </button>
    </div>

    <div class="popup-body">
      <MessagesDisplay :messages="messagesToShow" /> 
    </div>


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
import MessagesDisplay from './MessagesDisplay.vue'; // Εισαγωγή του νέου component
import { useMessageStore } from '../stores/messages.store'; // Για τον καθαρισμό του badge
import { sendMessage } from 'webext-bridge/content-script';
import { mockSystemMessages } from '../utils/mockData';

interface PopupState {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isVisible = ref(false);
const popupEl = ref<HTMLElement | null>(null);
const localMessageStore = useMessageStore(); // Χρήση του τοπικού store που συγχρονίζεται από το background

// DEV: Toggle to use mock data
const useMockData = false; // Set to true for development/testing

const messagesToShow = computed(() => useMockData ? mockSystemMessages : localMessageStore.messages);

// --- State for Dragging and Resizing ---
// ... (η υπόλοιπη λογική για drag/resize παραμένει ως έχει)
const operation = ref<'idle' | 'dragging' | 'resizing'>('idle');
const dragStartPos = ref({ x: 0, y: 0 });
const initialPopupState = ref<PopupState | null>(null);
const activeResizeHandle = ref<string | null>(null);

const defaultState: PopupState = {
  x: window.innerWidth - 380, // Default X
  y: 60,                      // Default Y (πιο κοντά στην κορυφή)
  width: 360,                 // Default Width
  height: 450,                // Default Height
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
  // ... (παραμένει ως έχει)
    let newX = state.value.x;
    let newY = state.value.y;
    const currentWidth = state.value.width;
    const currentHeight = state.value.height;

    if (newX + currentWidth > window.innerWidth) {
        newX = window.innerWidth - currentWidth - 5;
    }
    if (newY + currentHeight > window.innerHeight) {
        newY = window.innerHeight - currentHeight - 5;
    }
    if (newX < 0) newX = 5;
    if (newY < 0) newY = 5;

    state.value.x = newX;
    state.value.y = newY;
};

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
    sendMessage('clear-change-counters', null).catch(e => console.warn("CS: Failed to send clear-change-counters", e));
    sendMessage('popup-visibility-changed', { visible: false }).catch(e => console.warn("CS: Failed to send popup-visibility-changed", e));
}

const toggleVisibility = () => {
  if (isVisible.value) {
    closePopupAndClearBadge();
  } else {
    show();
    sendMessage('clear-change-counters', null).catch(e => console.warn("CS: Failed to send clear-change-counters", e));
    sendMessage('popup-visibility-changed', { visible: true }).catch(e => console.warn("CS: Failed to send popup-visibility-changed", e));
  }
};
// --- Drag (Move) Logic ---
// ... (παραμένει ως έχει)
const handleDragStart = (event: MouseEvent) => {
  if (operation.value !== 'idle') return;
  operation.value = 'dragging';
  initialPopupState.value = { ...state.value };
  dragStartPos.value = { x: event.clientX, y: event.clientY };

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  document.body.style.userSelect = 'none';
};

// --- Resize Logic ---
// ... (παραμένει ως έχει)
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

// --- Unified Mouse Move for Drag & Resize ---
// ... (παραμένει ως έχει)
const handleMouseMove = (event: MouseEvent) => {
  if (operation.value === 'idle' || !initialPopupState.value) return;
  event.preventDefault();

  const dx = event.clientX - dragStartPos.value.x;
  const dy = event.clientY - dragStartPos.value.y;

  if (operation.value === 'dragging') {
    let newX = initialPopupState.value.x + dx;
    let newY = initialPopupState.value.y + dy;

    newX = Math.max(0, Math.min(newX, window.innerWidth - state.value.width));
    newY = Math.max(0, Math.min(newY, window.innerHeight - state.value.height));
    state.value.x = newX;
    state.value.y = newY;

  } else if (operation.value === 'resizing' && activeResizeHandle.value) {
    let newWidth = initialPopupState.value.width;
    let newHeight = initialPopupState.value.height;

    if (activeResizeHandle.value.includes('r')) {
      newWidth = Math.max(minWidth, initialPopupState.value.width + dx);
    }
    if (activeResizeHandle.value.includes('b')) {
      newHeight = Math.max(minHeight, initialPopupState.value.height + dy);
    }
    state.value.width = Math.min(newWidth, window.innerWidth - state.value.x);
    state.value.height = Math.min(newHeight, window.innerHeight - state.value.y);
  }
};

// --- Unified Mouse Up for Drag & Resize ---
// ... (παραμένει ως έχει)
const handleMouseUp = () => {
  if (operation.value === 'idle') return;
  operation.value = 'idle';
  activeResizeHandle.value = null;
  initialPopupState.value = null;

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.body.style.userSelect = '';
};


onUnmounted(() => {
  // ... (παραμένει ως έχει)
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  if (document.body.style.userSelect === 'none') {
    document.body.style.userSelect = '';
  }
});

defineExpose({ show, hide, toggleVisibility, isVisible }); // Expose isVisible

const showErrorBanner = computed(() => localMessageStore.changeCounters.newErrors > 0);
const clearChangeCounters = () => {
  localMessageStore.clearChangeCounters();
};

const pollingEnabled = ref(false);
const pollingInterval = ref(20000);

const onPollingToggle = () => {
  sendMessage('set-polling-enabled', pollingEnabled.value).catch(e => console.warn('Failed to set polling enabled', e));
};
const onIntervalChange = () => {
  sendMessage('set-polling-interval', pollingInterval.value).catch(e => console.warn('Failed to set polling interval', e));
};
</script>

<style scoped>
/* ... (οι υπάρχουσες κλάσεις CSS παραμένουν, προσέξτε το popup-body) ... */
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
  overflow: hidden;
}

.popup-header {
  background-color: #f0f0f0;
  padding: 8px 12px;
  cursor: move;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 36px;
  box-sizing: border-box;
  flex-shrink: 0; /* Header won't shrink */
}

.popup-header h4 {
  margin: 0;
  font-size: 1em;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-button {
  background: none;
  border: none;
  font-size: 20px;
  font-weight: bold;
  color: #777;
  cursor: pointer;
  padding: 0 5px;
  line-height: 1;
}
.close-button:hover {
  color: #333;
}

.popup-body {
  /* padding: 15px;  -> Το padding θα το διαχειρίζεται το MessagesDisplay.vue */
  color: #555;
  flex-grow: 1;
  overflow-y: auto; /* Επιτρέπει scroll στο σώμα του popup */
  font-size: 14px;
  min-height: 0; /* Για σωστή λειτουργία του flex-grow με overflow */
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  /* background-color: rgba(0,0,0,0.1); For debugging handles */
}

.resize-handle-br {
  bottom: 0;
  right: 0;
  width:10%;
  height:10%;
  cursor: nwse-resize;
}
.resize-handle-r {
  top: 0;
  right: 0;
  width: 5px; /* Thinner edge handle */
  height: 85%;
  cursor: ew-resize;
}
.resize-handle-b {
  bottom: 0;
  left: 0;
  width: 85%;
  height: 5px; /* Thinner edge handle */
  cursor: ns-resize;
}

/* Example for a top-left handle (add to template and handleResizeStart if needed)
.resize-handle-tl {
  top: 0;
  left: 0;
  cursor: nwse-resize;
}
*/

.popup-error-banner {
  background: #ffebee;
  color: #c62828;
  padding: 8px 12px;
  text-align: center;
  font-weight: bold;
  cursor: pointer;
  border-bottom: 1px solid #d32f2f;
  border-radius: 8px 8px 0 0;
}

.polling-controls {
  display: flex;
  align-items: center;
  margin-right: 12px;
  float: right;
}
</style>