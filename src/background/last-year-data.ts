// src/background/last-year-data.ts
import { onMessage, sendMessage } from 'webext-bridge/background';
import { toRaw } from 'vue';
import type { LastYearDataItem, LastYearData } from '../types/bridge';
import { messageStore } from './state';

// --- Interfaces & Cache ---
interface LastYearDataCache {
  applicationId: string;
  data: LastYearData;
}

let lastYearDataCache: LastYearDataCache | null = null;

/**
 * Fetches data from the previous year for a given application ID.
 * @param appId The application ID.
 */
export async function fetchLastYearsData(appId: string): Promise<void> {
  console.log(`BG-Data: Fetching last year's data for application:`, appId);
  
  // If we have valid cached data, serve it immediately.
  if (lastYearDataCache?.applicationId === appId) {
    console.info('BG-Data: Serving last year data from cache for app:', appId);
    sendMessage('last-year-data-updated', { data: toRaw(lastYearDataCache.data) } as any, 'popup').catch(e => console.warn(e));
    return;
  }

  // Notify UI that a fetch is starting
  sendMessage('last-year-data-updated', { data: null, error: null, isLoading: true }, 'popup').catch(e => console.warn(e));

  try {
    const lastYear = new Date().getFullYear() - 1;
    const endpoints = {
      paa: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetedeaeepaa/findAllByCriteriaRange_EdetedeaeehdGrpEdaa',
      eco: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetedeaeeeco/findAllByCriteriaRange_EdetedeaeehdGrpEdeg',
      con: 'https://eae2024.opekepe.gov.gr/eae2024/rest/Edetedeaeerequest/findAllByCriteriaRange_EdetedeaeehdGrpEdrq'
    };

    const requests = Object.entries(endpoints).map(([key, url]) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edeId_id: appId, gParams_yearEae: lastYear, fromRowIndex: 0, toRowIndex: 10000 }),
      }).then(res => {
        if (!res.ok) throw new Error(`Request for ${key} failed with status ${res.status}`);
        return res.json();
      })
    );

    const [paaRes, ecoRes, conRes] = await Promise.all(requests);

    const result: LastYearData = {
      paa: paaRes.data.map((item: any) => ({ name: item.eaaId.description, code: item.eaaId.kodikos })),
      oikologika: ecoRes.data.map((item: any) => ({ name: item.esgrId.esceId.description, code: item.esgrId.esceId.kodikos })),
      enisxyseis: conRes.data.map((item: any) => ({ name: item.eschId.description, code: item.eschId.kodikos })),
    };

    lastYearDataCache = { applicationId: appId, data: result };
    sendMessage('last-year-data-updated', { data: toRaw(result), isLoading: false } as any, 'popup').catch(e => console.warn(e));
    console.info('BG-Data: Successfully fetched and sent last year\'s data.');
  } catch (error: any) {
    console.error('BG-Data: Error fetching last year\'s data:', error);
    lastYearDataCache = null; // Clear cache on error
    sendMessage('last-year-data-updated', { error: error.message || 'Άγνωστο σφάλμα', isLoading: false }, 'popup').catch(e => console.warn(e));
  }
}

/**
 * Registers message listeners related to last year's data.
 */
export function registerLastYearDataHandlers(): void {
  onMessage('request-last-year-data-fetch', async () => {
    const appId = messageStore.currentApplicationId;
    if (appId) {
      await fetchLastYearsData(appId);
    } else {
      return { error: 'Δεν έχει επιλεγεί αίτηση.' };
    }
  });
}