import { defineStore } from 'pinia';
import { useBrowserLocalStorage } from '../composables/useBrowserStorage';
import type { KeaParams } from '../types/kea';

export const useKeaStore = defineStore('kea', () => {
  const { data: keaParams, promise: keaParamsPromise } = useBrowserLocalStorage<KeaParams>('keaParams', {
    gUserType: 'ONLINE',
    globalUserVat: '',
    e_bi_gSubExt_id: '',
  });

  const allKeaSettingsLoaded = Promise.all([keaParamsPromise]);

  return {
    keaParams,
    allKeaSettingsLoaded,
  };
});
