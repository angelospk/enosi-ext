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
    // Add other fields if needed from the fetched data
  }
  
  const props = defineProps<{
    items: CommunityItem[];
    targetInput: HTMLInputElement | null; // Pass the target input for positioning and context
  }>();
  
  const localFilterText = ref('');
  const isVisible = ref(false);
  const selectedIndex = ref(-1);
  const popupRef = ref<HTMLDivElement | null>(null);
  
  
  const filteredItems = computed(() => {
    if (!localFilterText.value) {
      return props.items;
    }
    return props.items.filter(item =>
      item.description.toLowerCase().includes(localFilterText.value.toLowerCase()) ||
      item.kodikos.toLowerCase().includes(localFilterText.value.toLowerCase())
    );
  });
  
  watch(filteredItems, () => {
    selectedIndex.value = filteredItems.value.length > 0 ? 0 : -1;
  }, { immediate: true });
  
  // Expose methods to be called by the content script
  defineExpose({
    setFilterText(text: string) {
      localFilterText.value = text;
      if (!isVisible.value && text.length > 0 && filteredItems.value.length > 0) {
         // isVisible.value = true; // Only show if there are results and text is being typed
      } else if (filteredItems.value.length === 0) {
         // isVisible.value = false;
      }
    },
    show() {
      if (filteredItems.value.length > 0) {
          isVisible.value = true;
          if (selectedIndex.value < 0 && filteredItems.value.length > 0) {
              selectedIndex.value = 0;
          }
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
    }
  });
  
  function handleItemSelect(item: CommunityItem) {
    if (popupRef.value) {
      const event = new CustomEvent('community-item-selected', {
        detail: item,
        bubbles: true, // Allow event to bubble up to the container div
        composed: true // Allow event to cross shadow DOM boundaries if you use one later
      });
      popupRef.value.dispatchEvent(event);
    }
    isVisible.value = false;
  }
  
  function scrollToSelected() {
    if (!popupRef.value || selectedIndex.value < 0) return;
    const listElement = popupRef.value.querySelector('ul');
    const selectedLi = listElement?.children[selectedIndex.value] as HTMLLIElement;
    if (selectedLi) {
      selectedLi.scrollIntoView({ block: 'nearest' });
    }
  }
  
  // Clicking outside to hide
  function handleClickOutside(event: MouseEvent) {
    if (
      isVisible.value &&
      popupRef.value &&
      !popupRef.value.contains(event.target as Node) &&
      event.target !== props.targetInput // Don't hide if click is back on target input
    ) {
      isVisible.value = false;
    }
  }
  
  onMounted(() => {
    document.addEventListener('click', handleClickOutside, true);
  });
  
  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside, true);
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