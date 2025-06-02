<template>
  <div
    v-if="isVisible"
    class="persistent-icon-popup-content"
    :style="{
      top: state.y + 'px',
      left: state.x + 'px',
      width: state.width + 'px',
      height: state.height + 'px',
    }"
    ref="popupEl"
  >
    <div
      class="popup-header"
      @mousedown.prevent="handleDragStart"
    >
      <h4>Extension Popup</h4>
      <button class="close-button" @click.stop="closePopup" title="Close">×</button>
    </div>

    <div class="popup-body">
      <p>Content for this popup will be added later.</p>
      <p style="font-size: 0.8em; opacity: 0.7;">
        Pos: X: {{ Math.round(state.x) }}, Y: {{ Math.round(state.y) }}<br/>
        Size: W: {{ Math.round(state.width) }}, H: {{ Math.round(state.height) }}
      </p>
    </div>

    <!-- Resize Handles -->
    <div class="resize-handle resize-handle-br" @mousedown.prevent="handleResizeStart($event, 'br')"></div>
    <div class="resize-handle resize-handle-r" @mousedown.prevent="handleResizeStart($event, 'r')"></div>
    <div class="resize-handle resize-handle-b" @mousedown.prevent="handleResizeStart($event, 'b')"></div>
    
    <!-- Add more handles (t, l, tl, tr, bl) if needed, adjusting logic in handleResizing -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage'; // Adjust path if necessary

interface PopupState {
  x: number;
  y: number;
  width: number;
  height: number;
}

const isVisible = ref(false);
const popupEl = ref<HTMLElement | null>(null);

// --- State for Dragging and Resizing ---
const operation = ref<'idle' | 'dragging' | 'resizing'>('idle');
const dragStartPos = ref({ x: 0, y: 0 }); // For both drag and resize start mouse pos
const initialPopupState = ref<PopupState | null>(null); // For state at drag/resize start
const activeResizeHandle = ref<string | null>(null);

// Default state, will be overridden by stored state
const defaultState: PopupState = {
  x: window.innerWidth - 320, // Adjusted for default width
  y: window.innerHeight - 300, // Adjusted for default height
  width: 300,
  height: 200,
};

// Min dimensions
const minWidth = 150;
const minHeight = 100;

// Use browser storage for the entire state (position and size)
const { data: state, promise: statePromise } = useBrowserLocalStorage<PopupState>(
  'persistentPopupState', // Single key for combined state
  { ...defaultState }
);

onMounted(async () => {
  await statePromise.value; // Wait for storage to load
  // Validate and reset if necessary
  if (state.value.width < minWidth) state.value.width = defaultState.width;
  if (state.value.height < minHeight) state.value.height = defaultState.height;
  ensureInViewport();
});

const ensureInViewport = () => {
  if (!popupEl.value && !isVisible.value) return; // Don't run if not visible or no element yet

    // Use current state values for x, y, width, height
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

const toggleVisibility = () => {
  if (isVisible.value) hide();
  else show();
};

const closePopup = () => hide();

// --- Drag (Move) Logic ---
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
const handleMouseMove = (event: MouseEvent) => {
  if (operation.value === 'idle' || !initialPopupState.value) return;
  event.preventDefault();

  const dx = event.clientX - dragStartPos.value.x;
  const dy = event.clientY - dragStartPos.value.y;

  if (operation.value === 'dragging') {
    let newX = initialPopupState.value.x + dx;
    let newY = initialPopupState.value.y + dy;

    // Constrain position to viewport
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
    // Add conditions for 'l' and 't' if you implement those handles
    // e.g., if (activeResizeHandle.value.includes('l')) {
    //   const newTentativeWidth = initialPopupState.value.width - dx;
    //   if (newTentativeWidth >= minWidth) {
    //     state.value.x = initialPopupState.value.x + dx;
    //     newWidth = newTentativeWidth;
    //   }
    // }

    // Ensure popup does not go off-screen during resize
    state.value.width = Math.min(newWidth, window.innerWidth - state.value.x);
    state.value.height = Math.min(newHeight, window.innerHeight - state.value.y);
  }
};

// --- Unified Mouse Up for Drag & Resize ---
const handleMouseUp = () => {
  if (operation.value === 'idle') return;
  operation.value = 'idle';
  activeResizeHandle.value = null;
  initialPopupState.value = null;

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  document.body.style.userSelect = '';
  // State is already updated and useBrowserLocalStorage will auto-save
};

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  if (document.body.style.userSelect === 'none') {
    document.body.style.userSelect = '';
  }
});

defineExpose({ show, hide, toggleVisibility });
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
  overflow: hidden; /* Important if handles are pseudo-elements or partially outside */
  /* min-width and min-height are enforced in JS now */
}

.popup-header {
  background-color: #f0f0f0;
  padding: 8px 12px;
  cursor: move;
  border-bottom: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 36px; /* Fixed header height */
  box-sizing: border-box;
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
  padding: 15px;
  color: #555;
  flex-grow: 1;
  overflow-y: auto; /* Allow body to scroll if content exceeds new height */
  font-size: 14px;
}
.popup-body p {
  margin-top: 0;
  margin-bottom: 10px;
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
</style>