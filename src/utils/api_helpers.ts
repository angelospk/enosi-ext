export const EAE_YEAR = 2025;

/**
 * Performs a fetch request to the specified API endpoint.
 * @param endpoint - The API endpoint to call.
 * @param body - The request payload.
 * @returns The JSON response from the API.
 */
export const fetchApi = async (endpoint: string, body: any): Promise<any> => {
    const url = `https://eae2024.opekepe.gov.gr/eae2024/rest/${endpoint}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/plain, */*'
            },
            credentials: 'include',
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            let errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                errorText = errorJson.message || errorText;
            } catch (e) { /* Ignore */ }
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Fetch failed for ${endpoint}:`, error);
        throw error;
    }
};

/**
 * Prepares an entity object for an API request by cleaning it and converting dates.
 * @param entity - The entity object to prepare.
 * @returns The prepared entity.
 */
export const prepareEntityForRequest = (entity: any): any => {
    if (!entity) return null;
    const preparedEntity = JSON.parse(JSON.stringify(entity));
    const dateKeys = ['dteinsert', 'dteupdate', 'dtebirth', 'dtedke', 'dteprotocol', 'dtestartekm', 'dteasfalish', 'dtedraststart', 'dteonlineproseas', 'dteOris'];

    function traverseAndPrepare(obj: any): any {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => traverseAndPrepare(item));

        delete obj.$entityName;
        delete obj.$refId;

        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                let value = obj[key];
                if (dateKeys.includes(key) && typeof value === 'number') {
                    value = new Date(value).toISOString();
                }
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    if (value.id !== undefined && value.id !== null) {
                        value = { id: value.id };
                    } else if (value.kodikos !== undefined && value.kodikos !== null && Object.keys(value).length <= 5) {
                        value = { kodikos: value.kodikos };
                    } else {
                        value = traverseAndPrepare(value);
                    }
                } else if (value && typeof value === 'object' && Array.isArray(value)) {
                    value = traverseAndPrepare(value);
                }
                if (value !== null && value !== undefined) {
                    if (typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0) {
                        newObj[key] = value;
                    }
                }
            }
        }
        return newObj;
    }
    return traverseAndPrepare(preparedEntity);
};

/**
 * Sends a batch of changes to the backend for synchronization.
 * @param dataArray - The array of change objects.
 * @returns The API response.
 */
export const synchronizeChanges = async (dataArray: any[]): Promise<any> => {
    const preparedDataArray = dataArray.map(change => ({
        ...change,
        entity: prepareEntityForRequest(change.entity)
    }));
    return fetchApi('MainService/synchronizeChangesWithDb_Edetedeaeeagroi', {
        params: { data: preparedDataArray }
    });
};

/**
 * A wrapper for synchronizeChanges that also handles fetching the main application header (Edehd)
 * and adding it to the list of changes, which is required for most sync operations.
 * @param changes - The array of changes to execute (without the Edehd).
 * @param mainApplicationId - The ID of the main application.
 * @returns The result of the synchronizeChanges call.
 */
export const executeSync = async (changes: any[], mainApplicationId: string): Promise<any> => {
    if (!mainApplicationId) {
        throw new Error("Main Application ID is required for executeSync.");
    }
    if (changes.length === 0) {
        console.warn("executeSync called with no changes.");
        return;
    }

    const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: mainApplicationId });
    const currentEdehd = edehdResponse.data[0];

    const updatedEdehd = {
        ...currentEdehd,
        rowVersion: currentEdehd.rowVersion + 2
    };

    const finalChanges = changes.map(change => ({
        ...change,
        when: change.when || Date.now(),
    }));

    finalChanges.push({
        status: 1, // Update
        when: 0,
        entityName: "Edetedeaeehd",
        entity: updatedEdehd
    });

    return synchronizeChanges(finalChanges);
}; 