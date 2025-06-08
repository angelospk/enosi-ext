<template>
  <div v-if="isVisible" class="search-popup-container" :style="positionStyle">
    <ul v-if="results.length > 0" class="search-results-list">
      <li
        v-for="(item, index) in results"
        :key="`${item.category_code}-${item.code}`"
        :class="{ 'selected': index === selectedIndex }"
        @mousedown.prevent="() => confirmSelection(item)"
      >
        <span :class="`category-indicator-${item.category_code.toLowerCase()}`">[{{ item.category_code }}]</span>
        {{ item.name }}
        <span class="item-code">(Κωδ: {{ item.code }})</span>
      </li>
    </ul>
    <div v-else-if="isLoading" class="no-results">
      Φόρτωση...
    </div>
    <div v-else-if="!isLoading" class="no-results">
      Δεν βρέθηκαν αποτελέσματα για την αναζήτηση.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SearchableItem } from '../stores/search.store';

const props = defineProps<{
  results: SearchableItem[];
  selectedIndex: number;
  isLoading: boolean;
  isVisible: boolean;
  targetElement: HTMLInputElement | null;
}>();

const emit = defineEmits(['item-selected', 'close']);

const positionStyle = computed(() => {
  if (!props.targetElement) return {};
  const rect = props.targetElement.getBoundingClientRect();
  return {
    top: `${rect.bottom + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    // width: `${rect.width}px`,
  };
});

function confirmSelection(item: SearchableItem) {
  // simulate pressing Enter
  const event = new KeyboardEvent('keydown', { key: 'Enter' });
  document.dispatchEvent(event);

  emit('item-selected', item);
}

// The parent component will now control visibility and results
</script>

<style scoped>
.search-popup-container {
  position: absolute;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 2147483647;
  width: fit-content;
  max-height: 300px;
  overflow-y: auto;
  font-family: sans-serif;
  padding-top: 5px;
  padding-bottom: 5px;
}

.search-results-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.search-results-list li {
  padding: 10px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
}

.search-results-list li:hover,
.search-results-list li.selected {
  background-color: #f0f0f0;
}

.no-results {
  padding: 12px;
  color: #666;
  font-size: 14px;
}

.category-indicator-k { color: #2980b9; }
.category-indicator-p { color: #27ae60; }
.category-indicator-d { color: #f39c12; }
.category-indicator-m { color: #8e44ad; }
.category-indicator-o { color: #c0392b; }
.category-indicator-s { color: #7f8c8d; }
.category-indicator-t { color: #16a085; }
.category-indicator-a { color: #34495e; }

[class^="category-indicator-"] {
  font-weight: bold;
  margin-right: 8px;
  min-width: 25px;
  display: inline-block;
}

.item-code {
  margin-left: auto;
  color: #888;
  font-size: 12px;
}
</style> 