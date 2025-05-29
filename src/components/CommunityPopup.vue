<template>
    <div v-if="isVisible && filteredItems.length > 0" class="community-helper-popup" ref="popupRef">
      <ul>
        <li
          v-for="(item, index) in filteredItems"
          :key="item.kodikos"
          :class="{ selected: index === selectedIndex }"
          @mousedown.prevent="handleItemSelect(item)"
          @mouseenter="selectedIndex = index"
        >
          {{ item.description }} ({{ item.kodikos }})
        </li>
      </ul>
    </div>
  </template>
  
  <script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

interface CommunityItem {
  kodikos: string;
  description: string;
}

const props = defineProps<{
  items: CommunityItem[];
  targetInput: HTMLInputElement | null;
}>();

const localFilterText = ref('');
const isVisible = ref(false);
const selectedIndex = ref(-1);
const popupRef = ref<HTMLDivElement | null>(null);

const filteredItems = computed<CommunityItem[]>(() => {
  const filter = (localFilterText.value || '').toLowerCase();

  if (!props.items || !Array.isArray(props.items)) {
    return [];
  }

  // If no filter text, return all valid items
  if (!filter) {
    return props.items.filter(item => !!item); // Ensure items themselves are not null/undefined
  }

  return props.items.filter(item => {
    if (!item) return false; // Skip if item itself is null/undefined

    // Safely access description and kodikos, providing a fallback if they are null/undefined
    const descriptionString = item.description || '';
    const kodikosString = item.kodikos || '';

    const descriptionMatch = descriptionString.toLowerCase().includes(filter);
    const kodikosMatch = kodikosString.toLowerCase().includes(filter);

    return descriptionMatch || kodikosMatch;
  });
});

const hasSelection = computed(() => selectedIndex.value >= 0 && selectedIndex.value < filteredItems.value.length);

// Expose methods and reactive properties
defineExpose({
  setFilterText(text: string) {
    localFilterText.value = text;
  },
  show() {
    if (filteredItems.value.length > 0) { // Check current length of computed items
      isVisible.value = true;
      if (selectedIndex.value < 0 && filteredItems.value.length > 0) {
        selectedIndex.value = 0;
      }
    } else {
      isVisible.value = false; // Do not show if there's nothing to display
    }
  },
  hide() {
    isVisible.value = false;
    selectedIndex.value = -1;
  },
  navigate(direction: 'up' | 'down') {
    if (!isVisible.value || filteredItems.value.length === 0) return;
    if (direction === 'down') {
      selectedIndex.value = (selectedIndex.value + 1) % filteredItems.value.length;
    } else {
      selectedIndex.value = (selectedIndex.value - 1 + filteredItems.value.length) % filteredItems.value.length;
    }
    scrollToSelected();
  },
  confirmSelection() {
    if (isVisible.value && selectedIndex.value >= 0 && selectedIndex.value < filteredItems.value.length) {
      handleItemSelect(filteredItems.value[selectedIndex.value]);
    }
  },
  isPopupVisible: computed(() => isVisible.value), // For content script to reactively check visibility
  hasSelection,
  // Expose the reactive filteredItems itself (it's a ComputedRef)
  // The content script will need to access its .value to get the array
  currentFilteredItems: filteredItems
});

function handleItemSelect(item: CommunityItem) {
  // ... (rest of the function)
}
function scrollToSelected() {
  // ... (rest of the function)
}
function handleClickOutside(event: MouseEvent) {
    if (
        isVisible.value &&
        popupRef.value &&
        !popupRef.value.contains(event.target as Node) &&
        event.target !== props.targetInput && // Don't hide if click is back on the input
        !(props.targetInput?.contains(event.target as Node)) // Also check if click is within a child of targetInput
    ) {
        // Check if the click target is part of any other community helper instance (if multiple exist)
        const allPopupContainers = document.querySelectorAll('[id^="community-helper-popup-container-"]');
        let clickedInsideAnotherPopup = false;
        allPopupContainers.forEach(container => {
            if (container.contains(event.target as Node) && container !== popupRef.value?.parentElement) {
                clickedInsideAnotherPopup = true;
            }
        });

        if (!clickedInsideAnotherPopup) {
            isVisible.value = false;
        }
    }
}


onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside, true); // Use mousedown for earlier capture
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside, true);
});

</script>

<style scoped>
  .community-helper-popup {
    border: 1px solid #ccc;
    background-color: white;
    position: absolute;
    z-index: 2147483647; /* Max z-index */
    max-height: 250px;
    overflow-y: auto;
    min-width: 250px; /* Adjust as needed */
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    border-radius: 4px;
    margin-top: 2px; /* Small gap from the input field */
  }
  .community-helper-popup ul {
    list-style-type: none;
    padding: 0;
    margin: 0;
  }
  .community-helper-popup li {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .community-helper-popup li:hover {
    background-color: #f0f0f0;
  }
  .community-helper-popup li.selected {
    background-color: #e0e0e0; /* Or your theme's selection color */
    color: #333;
  }
  </style>