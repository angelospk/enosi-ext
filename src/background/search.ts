// src/background/search.ts
import { onMessage } from 'webext-bridge/background';
import { toRaw } from 'vue';
import { useSearchStore, type SearchableItem, type DataCategoryCode } from '../stores/search.store';
import { pinia } from '../utils/pinia';

const searchStore = useSearchStore(pinia);

/**
 * Registers message listeners for search functionality.
 */
export function registerSearchHandlers(): void {
  onMessage('search:query', async ({ data }) => {
    const { query, category_code } = data as { query: string; category_code?: DataCategoryCode };
    console.info(`BG-Search: Query='${query}', Category=${category_code}`);

    // Ensure data is loaded before searching
    await searchStore.fetchAllInitialData();

    const results: SearchableItem[] = [];
    const lowerCaseQuery = query.toLowerCase();
    const recent = toRaw(searchStore.recentAndPopular);
    const allData = toRaw(searchStore.allData);

    // 1. Search in Recent & Popular (if no specific category)
    if (!category_code) {
      for (const item of recent) {
        if (item.name.toLowerCase().includes(lowerCaseQuery) || item.code.toLowerCase().includes(lowerCaseQuery)) {
          results.push(item);
        }
      }
    }

    // 2. Search in all data sets
    const categoriesToSearch = category_code ? [category_code] : Object.keys(allData) as DataCategoryCode[];
    for (const cat of categoriesToSearch) {
      const dataList = allData[cat as keyof typeof allData];
      if (dataList) {
        for (const item of dataList) {
          if (item.name.toLowerCase().includes(lowerCaseQuery) || item.code.toLowerCase().includes(lowerCaseQuery)) {
            // Avoid duplicates from recent search
            if (!results.some(r => r.code === item.code && r.category_code === item.category_code)) {
              results.push(item);
            }
          }
        }
      }
    }

    // Sort results: recent items first, then alphabetically
    results.sort((a, b) => {
      const aIsRecent = recent.some(r => r.code === a.code && r.category_code === a.category_code);
      const bIsRecent = recent.some(r => r.code === b.code && r.category_code === b.category_code);
      if (aIsRecent && !bIsRecent) return -1;
      if (!aIsRecent && bIsRecent) return 1;
      return a.name.localeCompare(b.name);
    });
    
    console.info(`BG-Search: Sending ${results.length} results.`);
    return results.slice(0, 50); // Limit results
  });

  onMessage('search:handle-selection', async ({ data: selectedItem }) => {
    if (selectedItem) {
      await searchStore.handleSelection(selectedItem as Omit<SearchableItem, 'selection_count'>);
    }
  });
}