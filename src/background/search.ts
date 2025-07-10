// src/background/search.ts
import { onMessage } from 'webext-bridge/background';
import { toRaw } from 'vue';
import { type SearchableItem, type DataCategoryCode } from '../stores/search.store';
import { searchStore } from './state';

const MAX_RECENT_ITEMS = 100;
const GLOBAL_SEARCH_THRESHOLD = 20; // If recent results are less than this, search allData.

/**
 * Registers message listeners for search functionality.
 */
export function registerSearchHandlers(): void {
  onMessage('search:query', async ({ data }) => {
    const { query } = data as { query: string };
    console.info(`BG-Search: Query='${query}'`);

    // Ensure data is loaded before searching
    await searchStore.fetchAllInitialData();

    // On focus (empty query): return recentAndPopular sorted by timestamp
    if (!query) {
      const recent = [...toRaw(searchStore.recentAndPopular)]; // Create a copy for sorting
      // The type needs to accommodate last_selected_timestamp.
      recent.sort((a: any, b: any) => (b.last_selected_timestamp || 0) - (a.last_selected_timestamp || 0));
      console.info(`BG-Search: Sending ${recent.length} recent items on focus.`);
      return recent.slice(0, 50); // Limit results
    }

    const lowerCaseQuery = query.toLowerCase().trim();
    // Regex to capture category (one letter), operator (! or /), and the rest of the query
    const match = lowerCaseQuery.match(/^([a-zA-Zα-ωΑ-Ω])([!/])(.*)$/);

    if (match) {
      // Categorized search
      let category = match[1].toUpperCase();
      const operator = match[2];
      const searchTerm = match[3].trim();
      let results: SearchableItem[] = [];

      if (operator === '!') {
        // Search "recent & popular" for the given category
        const allRecent = toRaw(searchStore.recentAndPopular);
        if (category === "P"){ category = "Π";}
        if (category === "D"){ category = "Δ";}
        if (category === "K"){ category = "Κ";}
        results = allRecent.filter(item =>
          item.category_code.toUpperCase() === category
          && (item.name.toLowerCase().includes(searchTerm) || item.code.toLowerCase().includes(searchTerm)),
        );
      } else if (operator === '/') {
        // Search allData for the given category
        const allData = toRaw(searchStore.allData);
        const dataList = allData[category as DataCategoryCode];
        if (dataList) {
          results = dataList.filter(item =>
            item.name.toLowerCase().includes(searchTerm) || item.code.toLowerCase().includes(searchTerm),
          );
        }
      }

      console.info(`BG-Search: Sending ${results.length} results for category search '${category}${operator}'.`);
      return results;
    } else {
      // Global search (no prefix)
      const allRecent = toRaw(searchStore.recentAndPopular);
      let results = allRecent.filter(item =>
        item.name.toLowerCase().includes(lowerCaseQuery) || item.code.toLowerCase().includes(lowerCaseQuery),
      );

      // If not enough results from recent, search allData
      if (results.length < GLOBAL_SEARCH_THRESHOLD) {
        const allData = toRaw(searchStore.allData);
        const categoriesToSearch = Object.keys(allData) as DataCategoryCode[];
        const allDataResults: SearchableItem[] = [];

        for (const cat of categoriesToSearch) {
          const dataList = allData[cat as keyof typeof allData];
          if (dataList) {
            for (const item of dataList) {
              if (item.name.toLowerCase().includes(lowerCaseQuery) || item.code.toLowerCase().includes(lowerCaseQuery)) {
                allDataResults.push(item);
              }
            }
          }
        }

        // Combine and remove duplicates
        const existingResultKeys = new Set(results.map(r => `${r.category_code}-${r.code}`));
        const uniqueNewResults = allDataResults.filter(r => !existingResultKeys.has(`${r.category_code}-${r.code}`));
        results = [...results, ...uniqueNewResults];
      }

      console.info(`BG-Search: Sending ${results.length} results for global search.`);
      return results.slice(0, 50);
    }
  });

  onMessage('search:handle-selection', async ({ data: selectedItem }) => {
    if (!selectedItem) return;

    const item = selectedItem as any;

    const dataList = searchStore.allData[item.category_code as keyof typeof searchStore.allData];
    const allDataItem = dataList?.find(d => d.code === item.code);

    let currentSelectionCount = 1;
    if (allDataItem) {
      allDataItem.selection_count = (allDataItem.selection_count || 0) + 1;
      currentSelectionCount = allDataItem.selection_count;
    }

    const recentAndPopular = toRaw(searchStore.recentAndPopular) as any[];
    const recentItemIndex = recentAndPopular.findIndex(r => r.code === item.code && r.category_code === item.category_code);

    const timestamp = Date.now();

    if (recentItemIndex > -1) {
      const existingItem = recentAndPopular[recentItemIndex];
      existingItem.last_selected_timestamp = timestamp;
      existingItem.selection_count = currentSelectionCount;
    } else {
      const newItemForRecent = {
        ...item,
        selection_count: currentSelectionCount,
        last_selected_timestamp: timestamp,
      };
      recentAndPopular.push(newItemForRecent);
    }

    recentAndPopular.sort((a, b) => {
      const tsCompare = (b.last_selected_timestamp || 0) - (a.last_selected_timestamp || 0);
      if (tsCompare !== 0) return tsCompare;

      const countCompare = (b.selection_count || 0) - (a.selection_count || 0);
      return countCompare;
    });

    const finalRecentAndPopular = recentAndPopular.slice(0, MAX_RECENT_ITEMS);

    // Ensure all items have the required properties before assigning back to the store
    searchStore.recentAndPopular = finalRecentAndPopular.map(i => ({
      ...i,
      last_selected_timestamp: i.last_selected_timestamp || timestamp,
      selection_count: i.selection_count || 0,
    })) as any;
  });
}