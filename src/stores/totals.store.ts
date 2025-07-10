import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchApi, EAE_YEAR } from '../utils/api';
import { useMessageStore } from './messages.store';

export interface SporosData {
  viewKey: string;
  edeId: number;
  afm: string;
  eschId: number;
  eschKodikos: string;
  eschDescription: string;
  efyId: number;
  efyKodikos: string;
  efyDescription: string;
  poiId: number;
  poiKodikos: string;
  poiDescription: string;
  minSporosqtyAnaHa: number;
  checkSporosqtyFlag: number;
  sporosqty: number;
  etiketes: number;
  epilektash: number;
  sporosqtyRequired: number;
  etos: number;
}

export const useTotalsStore = defineStore('totals', () => {
  const data = ref<SporosData[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const messageStore = useMessageStore();

  async function fetchTotals() {
    const appId = messageStore.currentApplicationId;
    if (!appId) {
      error.value = 'Δεν έχει επιλεγεί αίτηση.';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetchApi('Edevedeaeerequestsporo/findAllByCriteriaRange_EdevedeaeerequestsporoGrpEdevspo', {
        g_Ede_id: appId,
        gParams_yearEae: EAE_YEAR,
        fromRowIndex: 0,
        toRowIndex: 100, // Fetch up to 100 records
        exc_Id: []
      });
      data.value = response.data || [];
    } catch (e: any) {
      console.error('Error fetching totals:', e);
      error.value = e.message || 'Άγνωστο σφάλμα κατά τη λήψη των συνόλων.';
      data.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  return {
    data,
    isLoading,
    error,
    fetchTotals,
  };
});
