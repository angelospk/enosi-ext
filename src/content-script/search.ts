// content-scripts/search.ts

import { createApp, ref, watch, ComponentPublicInstance, h } from 'vue';
import { sendMessage } from 'webext-bridge/content-script';
import SearchPopup from '../components/SearchPopup.vue';
import type { SearchableItem, DataCategoryCode } from '../stores/search.store';
import { getIsUIVisible } from './ui';

// --- Module-level state for the search popup ---
const searchResults = ref<SearchableItem[]>([]);
const selectedIndex = ref(-1);
const searchIsLoading = ref(false);
const isPopupVisible = ref(false);
const activeTargetInput = ref<HTMLInputElement | null>(null);
let searchTimeout: number | null = null;
let searchPopupVm: ComponentPublicInstance | null = null;

function getCategoryFromInput(input: HTMLInputElement): DataCategoryCode | null {
  const field = input.closest('.q-field');
  if (!field) return null;
  const label = field.querySelector('.q-field__label');
  const labelText = label?.textContent?.toLowerCase() || '';
  if (labelText.includes('καλλιέργεια')) return 'Κ';
  if (labelText.includes('ποικιλία')) return 'Π';
  return null;
}

function onItemSelected(item: SearchableItem) {
  if (activeTargetInput.value) {
    activeTargetInput.value.value = item.code;
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
    activeTargetInput.value.dispatchEvent(enterEvent);
    hideSearchPopup();
    sendMessage('search:handle-selection', { ...item }).catch(console.error);
  }
}

async function performSearch() {
  if (!activeTargetInput.value) return;
  selectedIndex.value = -1;
  searchIsLoading.value = true;
  if (searchTimeout) clearTimeout(searchTimeout);

  const term = activeTargetInput.value.value;

  searchTimeout = window.setTimeout(async () => {
    if (term.length === 0 || !activeTargetInput.value) {
      searchResults.value = [];
      searchIsLoading.value = false;
      return;
    }
    const category = getCategoryFromInput(activeTargetInput.value);
    const results = await sendMessage('search:query', { query: term, category_code: category });
    searchResults.value = Array.isArray(results) ? (results as unknown as SearchableItem[]) : [];
    searchIsLoading.value = false;
  }, 250);
}

function showSearchPopup(target: HTMLInputElement) {
  activeTargetInput.value = target;
  isPopupVisible.value = true;
  performSearch();
}

function hideSearchPopup() {
  isPopupVisible.value = false;
  activeTargetInput.value = null;
  searchResults.value = [];
  selectedIndex.value = -1;
}

function setupEventListeners() {
  document.addEventListener('focusin', (e) => {
    if (!getIsUIVisible()) return;

    const target = e.target as HTMLInputElement;
    const isSearchable = target.tagName === 'INPUT' && target.closest('.q-field')?.querySelector('.q-field__append .q-icon[role="img"]')?.textContent?.trim() === 'search';
    if (isSearchable) {
      showSearchPopup(target);
    }
  }, true);

  document.addEventListener('input', (e) => {
    if (e.target === activeTargetInput.value) {
      performSearch();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (isPopupVisible.value) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (selectedIndex.value < searchResults.value.length - 1) selectedIndex.value++;
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (selectedIndex.value > 0) selectedIndex.value--;
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex.value !== -1 && searchResults.value[selectedIndex.value]) {
            onItemSelected(searchResults.value[selectedIndex.value]);
          }
          break;
        case 'Escape':
          hideSearchPopup();
          break;
      }
    }
  });

  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (document.activeElement !== activeTargetInput.value) {
        hideSearchPopup();
      }
    }, 150);
  });
}

export function initializeSearch() {
  const container = document.createElement('div');
  container.id = 'my-extension-search-popup-root';
  document.body.appendChild(container);

  const app = createApp({
    setup() {
      // This setup function makes the refs reactive in the template
      return {
        results: searchResults,
        selectedIndex,
        isLoading: searchIsLoading,
        isVisible: isPopupVisible,
        targetElement: activeTargetInput,
        onItemSelected,
      };
    },
    render() {
      return h(SearchPopup, {
        results: this.results,
        selectedIndex: this.selectedIndex,
        isLoading: this.isLoading,
        isVisible: this.isVisible,
        targetElement: this.targetElement,
        onItemSelected: this.onItemSelected,
      });
    }
  });

  searchPopupVm = app.mount(container);
  setupEventListeners();
  console.info("CS: In-page search system initialized.");
}