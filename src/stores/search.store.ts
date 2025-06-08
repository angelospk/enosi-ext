import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';

// =================================================================
//  TYPES
// =================================================================

// Main categories for data
export type DataCategoryCode = 'Κ' | 'Π' | 'Δ' | 'Μ' | 'Ο' | 'Σ' | 'Τ' | 'Α';

// Base structure for any item that can be searched and selected
export interface SearchableItem {
  id: string;       // The unique ID from the API (e.g., "87+bj04jLc3A6pzM6059Iw==")
  code: string;     // The business code (e.g., "90100305" or "1")
  name: string;
  category_code: DataCategoryCode;
  selection_count: number;
}

// Structure for items in the recent/popular list
export interface RecentItem extends SearchableItem {
  last_selected_timestamp: number;
}

// Structure for the user-managed dictionary of businesses/VAT numbers
export interface AfmItem {
  afm: string; // VAT number
  name: string;
}

// Structure for allData cache in the background
export type AllData = {
  [key in DataCategoryCode]?: SearchableItem[];
};

// =================================================================
//  STORE DEFINITION
// =================================================================

const MAX_RECENT_ITEMS = 100;

export const useSearchStore = defineStore('search', () => {
  // --- STATE ---

  // Main data cache, lives only in the background script memory.
  // Not reactive across the extension, it's a source of truth.
  const allData = ref<AllData>({});

  // Recent and popular selections, persisted to local storage to be available
  // across browser sessions.
  const { data: recentAndPopular, promise: recentPromise } =
    useBrowserLocalStorage<RecentItem[]>('search_recentAndPopular', []);
  
  // User-managed AFM/Business dictionary, persisted to local storage.
  const { data: afmDictionary, promise: afmPromise } =
    useBrowserLocalStorage<AfmItem[]>('search_afmDictionary', []);

  const isLoading = ref(false);
  const lastError = ref<string | null>(null);

  // --- ACTIONS ---

  /**
   * Fetches all required data from OPEKEPE endpoints and populates the allData cache.
   * This should be called from the background script on startup and possibly on demand.
   */
  async function fetchAllInitialData() {
    if (isLoading.value || Object.keys(allData.value).length > 0) return;

    isLoading.value = true;
    lastError.value = null;
    console.log('[SearchStore] Starting fetch for all initial data...');

    const currentYear = new Date().getFullYear();
    const newAllData: AllData = {};

    try {
      // Define all endpoints with their specific parsers
      const endpoints = [
        {
          category: 'Δ',
          url: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetdikaiol/findAllByCriteriaRange_Edetedeaeedikaiol_GrpEdl_itm__edkId?',
          body: { "gParams_yearEae": currentYear, "fromRowIndex": 0, "toRowIndex": 10000 },
          parser: (item: any) => ({ id: item.id, code: item.kodikos.toString(), name: item.description, category_code: 'Δ', selection_count: 0 }),
        },
        {
          category: 'Μ',
          url: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetpaa/findAllByCriteriaRange_Edetedeaeehd_GrpEdaaEp_itm__eaaId?',
          body: { "gParams_yearEae": currentYear, "fromRowIndex": 0, "toRowIndex": 10000 },
          parser: (item: any) => ({ id: item.id, code: item.kodikos, name: item.description, category_code: 'Μ', selection_count: 0 }),
        },
        {
          category: 'Κ',
          url: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetfytiko/findAllByCriteriaRange_EdetfytikoGrpEdetfytiko',
          body: { "gParams_yearEae": currentYear, "fromRowIndex": 0, "toRowIndex": 10000 },
          parser: (item: any) => ({ id: item.id, code: item.kodikos, name: item.description, category_code: 'Κ', selection_count: 0 }),
        }
      ];

      const fetchPromises = endpoints.map(source =>
        fetch(source.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(source.body)
        })
        .then(res => res.json())
        .then(response => {
          if (response && response.data) {
            newAllData[source.category as DataCategoryCode] = response.data.map(source.parser);
          }
        })
      );

      await Promise.all(fetchPromises);
      console.log('[SearchStore] Fetched initial batch of data.');
      
      // --- Special Handling for Varieties (Ποικιλίες), which depend on Crops (Καλλιέργειες) ---
      const crops = newAllData['Κ'];
      if (crops && crops.length > 0) {
        console.log(`[SearchStore] Fetching varieties for ${crops.length} crops...`);
        const varietyPromises = crops.map(crop =>
          fetch('https://eae2024.opekepe.gov.gr/eae2024/rest/Edetomapoi/findAllByCriteriaRange_EdetfytikoGrpEdetomapoi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "efyId_id": crop.id, "gParams_yearEae": currentYear, "fromRowIndex": 0, "toRowIndex": 10000 })
          })
          .then(res => res.json())
          .then(response => {
            if (response && response.data) {
              return response.data.map((item: any) => ({
                id: item.poiId.id,
                code: item.poiId.kodikos,
                name: item.poiId.description,
                category_code: 'Π',
                selection_count: 0,
              }));
            }
            return [];
          })
        );
        
        const varietiesByCrop = await Promise.all(varietyPromises);
        // Flatten the array of arrays and remove duplicates
        const allVarieties = varietiesByCrop.flat();
        const uniqueVarieties = Array.from(new Map(allVarieties.map(item => [item.id, item])).values());
        newAllData['Π'] = uniqueVarieties;
        console.log(`[SearchStore] Successfully fetched ${uniqueVarieties.length} unique varieties.`);
      }

      allData.value = newAllData;
      console.log('[SearchStore] Successfully fetched and processed all data.', allData.value);

    } catch (error: any) {
      lastError.value = error.message || "Unknown error during data fetch.";
      console.error('[SearchStore] Error fetching initial data:', error);
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Handles the logic when a user selects an item from the search results.
   * @param selectedItem The item that was selected.
   */
  async function handleSelection(selectedItem: Omit<SearchableItem, 'selection_count'>) {
    await recentPromise;

    // 1. Find the item in `allData` and update its selection_count
    const sourceItem = allData.value[selectedItem.category_code]?.find(item => item.id === selectedItem.id);
    if (sourceItem) {
        sourceItem.selection_count++;
    }

    // 2. Check if the item exists in `recentAndPopular`
    const existingRecentItem = recentAndPopular.value.find(
      item => item.id === selectedItem.id && item.category_code === selectedItem.category_code
    );

    if (existingRecentItem) {
      // 3a. If it exists, update timestamp and count
      existingRecentItem.last_selected_timestamp = Date.now();
      if (sourceItem) {
        existingRecentItem.selection_count = sourceItem.selection_count;
      }
    } else {
      // 3b. If it doesn't exist, create and add it
      const newRecentItem: RecentItem = {
        ...selectedItem,
        selection_count: sourceItem ? sourceItem.selection_count : 1,
        last_selected_timestamp: Date.now(),
      };
      recentAndPopular.value.unshift(newRecentItem); // Add to the front
    }
    
    // 4. Sort and trim the list
    // Sort by timestamp first (most recent), then by popularity.
    recentAndPopular.value.sort((a, b) => {
        const tsDiff = b.last_selected_timestamp - a.last_selected_timestamp;
        if (tsDiff !== 0) return tsDiff;
        return b.selection_count - a.selection_count;
    });

    // 5. Trim the list if it exceeds the max size
    if (recentAndPopular.value.length > MAX_RECENT_ITEMS) {
        recentAndPopular.value.splice(MAX_RECENT_ITEMS);
    }
  }


  return {
    // State
    allData,
    recentAndPopular,
    afmDictionary,
    isLoading,
    lastError,

    // Actions
    fetchAllInitialData,
    handleSelection,
  };
}); 