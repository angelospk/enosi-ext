import { useKeaStore } from '../stores/kea.store';
import { fetchApi } from './api';
/**
 * Removes geospatial data from the application's JSON structure to reduce file size.
 * @param data The application data object.
 * @returns The cleaned data object without geospatial fields.
 */
export function cleanGeospatialData(data: any): any {
    if (!data) {
        return data;
    }

    // Remove top-level keys if they exist
    if ('geospatial_background' in data) {
        delete data.geospatial_background;
    }
    if ('field_neighbourhood_list' in data) {
        delete data.field_neighbourhood_list;
    }

    // Process the list of fields to remove their geospatial data
    if (data.field_list && Array.isArray(data.field_list)) {
        for (const field of data.field_list) {
            if (field && typeof field === 'object' && 'field_geospatial_data' in field) {
                delete field.field_geospatial_data;
            }
        }
    }

    return data;
}


export async function getCleanedGeospatialData(appId: string, EAE_YEAR: number): Promise<any> {
    if (!appId) {
        alert('ID Αίτησης δεν έχει οριστεί. Ανανεώστε τη σελίδα πάνω σε μια αίτηση.');
        return;
    }
    const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: appId });
        const afm = edehdResponse.data[0].afm;
        const keaStore = useKeaStore();
        if (EAE_YEAR === 2024) {
            const prevYearEdeResponse = await fetchApi('MainService/getEdesByAfm?', { str_afm: afm, str_UserType: keaStore.keaParams.gUserType, globalUserVat: keaStore.keaParams.globalUserVat, e_bi_gSubExt_id: keaStore.keaParams.e_bi_gSubExt_id, i_etos: EAE_YEAR});
            const prevYearEdeId = prevYearEdeResponse.data[0].id;
            appId = prevYearEdeId;
        }
        const reportResponse = await fetchApi('Reports/ReportsBtnFrm_RepEdeCsBtn_action', { reportFormat: 1, BD_EDE_ID: appId, I_ETOS: EAE_YEAR });
        const base64String = reportResponse.data;
        const rawBinaryString = atob(base64String);
        const len = rawBinaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = rawBinaryString.charCodeAt(i);
        }
        const fileBlob = new Blob([bytes], { type: 'application/json' });
        const jsonData = JSON.parse(await fileBlob.text());
        const cleanedData = cleanGeospatialData(jsonData);
        return cleanedData;
}   