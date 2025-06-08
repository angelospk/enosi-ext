import { createApp, ref, nextTick, App as VueApp } from 'vue';
import { sendMessage } from 'webext-bridge/content-script';
import PersistentIconPopup from '../components/PersistentIconPopup.vue';
import SearchPopup from '../components/SearchPopup.vue';
import type { SearchableItem } from '../stores/search.store';
import { useMessageStore } from '../stores/messages.store';
import { useLastYearDataStore } from '../stores/lastYearData.store';
import { createPinia } from 'pinia';

console.info("Extension: Content script loaded.");

// --- Vue App Instances & UI Management ---
let persistentIconPopupVm: any = null;

function setupPersistentIcon() {
  const container = document.createElement('div');
  container.id = 'my-extension-persistent-icon-root';
  document.body.appendChild(container);

  const pinia = createPinia();
  const app = createApp(PersistentIconPopup);
  app.use(pinia);
  // Initialize stores so they are available for the popup
  useMessageStore(pinia);
  useLastYearDataStore(pinia);
  
  persistentIconPopupVm = app.mount(container);
  
  // Create the floating icon itself
  const iconElement = document.createElement('div');
  iconElement.id = 'my-extension-floating-icon';
  iconElement.addEventListener('click', () => persistentIconPopupVm?.toggleVisibility());
  document.body.appendChild(iconElement);
}

// --- Search Popup Logic (New Implementation) ---

let searchPopupVm: any = null;
const searchResults = ref<SearchableItem[]>([]);
const selectedIndex = ref(-1);
const searchIsLoading = ref(false);
const isPopupVisible = ref(false);
const activeTargetInput = ref<HTMLInputElement | null>(null);
let searchTimeout: number | null = null;

function setupSearchPopup() {
  const container = document.createElement('div');
  container.id = 'my-extension-search-popup-root';
  document.body.appendChild(container);

  const app = createApp(SearchPopup, {
    results: searchResults.value,
    selectedIndex: selectedIndex.value,
    isLoading: searchIsLoading.value,
    isVisible: isPopupVisible.value,
    targetElement: activeTargetInput.value,
    onItemSelected: (item: SearchableItem) => {
      if (activeTargetInput.value) {
        activeTargetInput.value.value = item.code;
        // Simulate an Enter keypress to trigger any page logic
        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true });
        activeTargetInput.value.dispatchEvent(enterEvent);
        hideSearchPopup();
      }
    },
  });

  searchPopupVm = app.mount(container);
}

function showSearchPopup(target: HTMLInputElement) {
  activeTargetInput.value = target;
  isPopupVisible.value = true;
  onSearch(); // Initial search
  searchPopupVm.$forceUpdate(); // Ensure props are reactive
}

function hideSearchPopup() {
  isPopupVisible.value = false;
  activeTargetInput.value = null;
  searchResults.value = [];
  selectedIndex.value = -1;
}

function onSearch() {
  if (!activeTargetInput.value) return;
  
  selectedIndex.value = -1;
  searchIsLoading.value = true;
  if (searchTimeout) clearTimeout(searchTimeout);

  const term = activeTargetInput.value.value;

  searchTimeout = window.setTimeout(async () => {
    if (term.length === 0) {
      // Potentially show recent/popular items here later
      searchResults.value = [];
      searchIsLoading.value = false;
      return;
    }
    
    const category = getCategoryFromInput(activeTargetInput.value);
    searchResults.value = await sendMessage('search:query', { query: term, category_code: category });
    searchIsLoading.value = false;
  }, 250);
}

function selectNext() {
  if (selectedIndex.value < searchResults.value.length - 1) {
    selectedIndex.value++;
  }
}

function selectPrevious() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  }
}

function confirmSelection() {
  if (selectedIndex.value !== -1 && searchResults.value[selectedIndex.value]) {
    searchPopupVm.onItemSelected(searchResults.value[selectedIndex.value]);
  }
}

function getCategoryFromInput(input: HTMLInputElement): string | null {
    const field = input.closest('.q-field');
    if (!field) return null;
    
    const label = field.querySelector('.q-field__label');
    const labelText = label?.textContent?.toLowerCase() || '';

    if (labelText.includes('καλλιέργεια')) return 'Κ';
    if (labelText.includes('ποικιλία')) return 'P';
    // Add other category mappings here
    return null;
}

// --- Global Event Listeners ---

document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLInputElement;
  const isSearchable = target.tagName === 'INPUT' && target.closest('.q-field')?.querySelector('.q-field__append .q-icon[role="img"][aria-hidden="true"]')?.textContent?.trim() === 'search';
  
  if (isSearchable) {
    showSearchPopup(target);
  }
}, true);

document.addEventListener('input', (e) => {
  if (e.target === activeTargetInput.value) {
    onSearch();
  }
});

document.addEventListener('keydown', (e) => {
  if (isPopupVisible.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectPrevious();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      confirmSelection();
    } else if (e.key === 'Escape') {
      hideSearchPopup();
    }
  }
});

document.addEventListener('focusout', (e) => {
  // Use a small timeout to allow a click on the popup to register
  setTimeout(() => {
    if (document.activeElement !== activeTargetInput.value) {
      hideSearchPopup();
    }
  }, 150);
});


// --- Main Initialization ---
function main() {
  setupPersistentIcon();
  setupSearchPopup();
}

main();