import { fetchApi, EAE_YEAR, prepareEntityForRequest } from './api';

// --- Σταθερές για IDs και Κωδικούς για ευκολότερη διαχείριση ---
const CONSTANTS = {
    // IDs για Άμεσες Ενισχύσεις (Edetedeaeerequest)
    ESCH_IDS: {
        ANADIANEMITIKI: 'tuDUgj3HP7PZZCh/70Ro/w==',
        SKLIROS_SITOS: '3u1xdPE4FZAqQT4Pm2e4tQ==',
        MALAKOS_SITOS: 'hU7dS7bG1ZMN/5Zz98Yjkg==',
        VAMVAKI: 'n8FWQG78kWo4DWgzxWdpow==',
    },
    // IDs (eaaId) για Μέτρα (Edetedeaeepaa - Εξισωτική)
    EXISOTIKI_EAA_IDS: {
        '13.1': 'Mp2KIglcsZZ2uDQChBzpTA==',
        '13.2': 'CrELmiSaJYsbI3KS6FGmvg==',
        '13.3': 'kJl/yXxRpEIM/wjzRDUS3A==',
    },
    // IDs για Οικολογικά Σχήματα (Edetedeaeeeco)
    ECO_SCHEME_IDS: {
        LIPASMATA: 'ck7Q9Gq/UBkTwjID7Ur4vg==',
        VIOLOGIKO: 'idonCkcn3mDYtA6vW3X5pg==',
    },
    // IDs για Δικαιολογητικά (Edetedeaeedikaiol)
    DIKAIOLOGITIKA_IDS: {
        TAYTOPROSOPIA: 'dJYbV47UtYLqMWj+1mas1A==', // 166
        KARTELA_SKLIROY: 'Zu50wPtrta9nV1CJTP3nkQ==',
        TIMOLOGIO_SKLIROY: 'Il95dg/Ibi1rCO7Uf/v90A==',
        KARTELA_MALAKOY: 'uMnQ+pmu2sxPxxVN0WVlNQ==',
        TIMOLOGIO_MALAKOY: 'DRvwyxmdjYpP6pztWL2S8Q==',
        KARTELA_VAMVAKIOY: 'UY4OQAw5jGRyp/pz1LZVZA==',
        TIMOLOGIO_VAMVAKIOY: 'Wi19dzZG2iOt8IXxFdUJlg==',
        LIPASMATA: 'LeTo1TqFJQmrGUNIUb4iPA==', // 215
        AKROFYSIA: 'bg7ijd2umwp6fMGcfg3ziA==',
    },
    // IDs για Σύμβαση Ηλίανθου (Edetedeaeemetcom)
    HLIANTHOS_IDS: {
        EMC_ID: 'KTSgRe2sSLggaN9qu8u/Pg==',
        EFEC_ID: 'WFUwa5UO57dxpXhnvqIKRA==',
    },
    DEFAULT_TIMOLOGIA: {
        skliros_sitos: {
            kalliergeia: "skliros_sitos",
            afm: " ",
            epwnymia: " ",
            hmerominia: new Date().toISOString(),
            posotita: 1,
            etiketes: 1,
            poikilia: { efyId: "VMxnJnQisDYspssypbAjjA==", poiId: "Zu50wPtrta9nV1CJTP3nkQ==" }
        },
        malakos_sitos: {
            kalliergeia: "malakos_sitos",
            afm: " ",
            epwnymia: " ",
            hmerominia: new Date().toISOString(),
            posotita: 1,
            etiketes: 1,
            poikilia: { efyId: "Zu50wPtrta9nV1CJTP3nkQ==", poiId: "iOkQVQUJWEdzY0IzwErItg==" }
        },
        vamvaki: {
            kalliergeia: "vamvaki",
            afm: " ",
            epwnymia: " ",
            hmerominia: new Date().toISOString(),
            posotita: 1,
            etiketes: 1,
            poikilia: { efyId: "78sdEMOgHjUYxJHA+vgG+g==", poiId: "/Kw9TbsKdLaah9jFsBXIeA==" }
        }
    },

    DEFAULT_VARIETIES: {
        skliros_sitos: { efyId: "VMxnJnQisDYspssypbAjjA==", poiId: "Zu50wPtrta9nV1CJTP3nkQ==" }, // π.χ. MARAKAS
        malakos_sitos: { efyId: "Zu50wPtrta9nV1CJTP3nkQ==", poiId: "iOkQVQUJWEdzY0IzwErItg==" }, // π.χ. SICARIO
        vamvaki: { efyId: "78sdEMOgHjUYxJHA+vgG+g==", poiId: "/Kw9TbsKdLaah9jFsBXIeA==" }      // π.χ. ZETA 2
    },
};


/**
 * "Ασφαλής" εκτέλεση ενός batch. Εκτελεί το batch μέσα σε ένα try...catch.
 * Αν αποτύχει, καταγράφει το σφάλμα και επιστρέφει false, αντί να σταματήσει το script.
 * @returns true αν το batch ήταν επιτυχές, false αν απέτυχε.
 */
async function executeSyncBatch(appId: string, changes: any[], endpoint: string, logMessage: string): Promise<boolean> {
    if (changes.length === 0) {
        console.log(`  -> Παράλειψη: ${logMessage} (δεν υπάρχουν αλλαγές).`);
        return true;
    }

    try {
        console.log(`  -> Εκτέλεση: ${logMessage} (${changes.length} αλλαγές)...`);
        const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: appId });
        const cleanedEdehd = prepareEntityForRequest(edehdResponse.data[0]);

        const finalChanges = changes.map(change => ({
            ...change,
            entity: prepareEntityForRequest(change.entity)
        }));

        finalChanges.push({
            status: 1, when: 0, entityName: "Edetedeaeehd", entity: cleanedEdehd
        });
        
        const response = await fetchApi(endpoint, { params: { data: finalChanges } });
        
        console.log(`     ...Ολοκληρώθηκε. Απάντηση:`, response);
        if (response && (response.warningMessages || response.errorMessages)) {
            console.warn(`     ...Προειδοποιήσεις/Σφάλματα από το server:`, response);
        }
        return true;

    } catch (error) {
        console.error(`--- ΣΦΑΛΜΑ στο βήμα: "${logMessage}" ---`, error);
        return false;
    }
}

/**
 * Εκτελεί μια μαζική ενημέρωση των γενικών στοιχείων, δικαιολογητικών και συμβάσεων
 * μιας αίτησης βάσει ενός JSON εισόδου.
 * @param jsonInput - Το αντικείμενο JSON με τις παραμέτρους.
 * @param appId - Το ID της κύριας αίτησης (edeId).
 */
export async function handleMassUpdateFromJson(jsonInput: any, appId: string) {
    console.log(`--- Έναρξη Μαζικής Ενημέρωσης για την αίτηση ${appId} ---`);
    document.body.style.cursor = 'wait';

    try {
        // --- ΒΗΜΑ 0: Αρχική Ανάκτηση Δεδομένων ---
        console.log("Βήμα 0: Ανάκτηση αρχικών δεδομένων...");
        await fetchApi('MainService/refreshGdpr', { edeId: appId, etos: EAE_YEAR });

        const anadianResp = await fetchApi('Anadian/findAllByCriteriaRange_EdetedeaeehdGrpEdeAnadian', { edeId_id: appId, fromRowIndex: 0, toRowIndex: 10, exc_Id: [] });
        const isEpileximosAnadian = anadianResp.data?.[0]?.epileximosflag === true;
        
        const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: appId });
        // Αποθηκεύουμε ολόκληρο το αντικείμενο { id: '...' } για να το χρησιμοποιούμε απευθείας.
        const sexIdObject = edehdResponse.data[0].sexId ? { id: edehdResponse.data[0].sexId.$refId} : null;
        if (!sexIdObject || !sexIdObject.id) {
            throw new Error("Δεν ήταν δυνατή η εύρεση του Subscriber ID (sexId) από την αίτηση.");
        }
        const afm = edehdResponse.data[0].afm;
        
        let tempIdCounter = 0;
        const getTempId = () => `TEMP_ID_${Date.now()}_${tempIdCounter++}`;

        // --- ΒΗΜΑ 1: Ενημέρωση Βασικών Στοιχείων Αίτησης (businessGroupFlag etc.) ---

// Παίρνουμε το "ακατέργαστο" αντικείμενο από το fetch
const rawEdehdEntity = edehdResponse.data[0];

// *** Η ΚΡΙΣΙΜΗ ΔΙΟΡΘΩΣΗ ΕΙΝΑΙ ΕΔΩ ***
// Το "καθαρίζουμε" χρησιμοποιώντας την έτοιμη helper function
const cleanedEdehdEntity = prepareEntityForRequest(rawEdehdEntity);

// Εφαρμόζουμε τις αλλαγές μας στο "καθαρό" αντικείμενο
const entityForUpdate = {
    ...cleanedEdehdEntity,
    businessGroupFlag: 0,
    entolheispflag: 1,
    entolhxreflag: 0,
    pendingelgaflag: 1
};

const initialEdehdUpdate = [{
    status: 1,
    when: Date.now(),
    entityName: 'Edetedeaeehd',
    entity: entityForUpdate
}];

        // Αυτή η κλήση δεν χρειάζεται την helper, γιατί το Edehd είναι ήδη μέσα.
        console.log("Βήμα 1: Ενημέρωση βασικών στοιχείων αίτησης...");
        await fetchApi('MainService/synchronizeChangesWithDb_Edetedeaeehd', { params: { data: initialEdehdUpdate }});
        console.log("  -> Ολοκληρώθηκε.");

        // --- ΒΗΜΑ 2: Προσθήκη Μέτρων Εξισωτικής ---
        if (jsonInput.exisotiki === true) {
            const metraResp = await fetchApi('Edetedeaeepaa/findAllByCriteriaRange_EdetedeaeehdGrpEdaa_count', { edeId_id: appId, gParams_yearEae: EAE_YEAR, exc_Id: [] });
            let metraKodikosCounter = metraResp.count;
            const metraChanges: any[] = [];
            
            Object.values(CONSTANTS.EXISOTIKI_EAA_IDS).forEach(eaaId => {
                metraKodikosCounter++;
                metraChanges.push({
                    status: 0, when: Date.now(), entityName: 'Edetedeaeepaa',
                    entity: {
                        id: getTempId(), afm: afm, kodikos: metraKodikosCounter, etos: EAE_YEAR, eaaLt2: 2,
                        recordtype: 0,
                        edeId: { id: appId }, eaaId: { id: eaaId }, sexId: sexIdObject
                    }
                });
            });
            await executeSyncBatch(appId, metraChanges, 'MainService/synchronizeChangesWithDb_Edetedeaeehd', 'Προσθήκη Μέτρων Εξισωτικής');
        }

        // --- ΒΗΜΑ 3: Προσθήκη Άμεσων Ενισχύσεων (Αναδιανεμητική & Συνδεδεμένες) ---
        const requestsResp = await fetchApi('Edetedeaeerequest/findAllByCriteriaRange_EdetedeaeehdGrpEdrq_count', { edeId_id: appId, gParams_yearEae: EAE_YEAR, exc_Id: [] });
        let requestsKodikosCounter = requestsResp.count;
        const requestChanges: any[] = [];
        
        if (isEpileximosAnadian) {
            requestsKodikosCounter++;
            requestChanges.push({
                status: 0, when: Date.now(), entityName: 'Edetedeaeerequest',
                entity: { id: getTempId(), afm: afm, kodikos: requestsKodikosCounter, etos: EAE_YEAR, recordtype: 0, eschLt2: 2, edeId: { id: appId }, eschId: { id: CONSTANTS.ESCH_IDS.ANADIANEMITIKI }, sexId: sexIdObject }
            });
        }
        
        const syndedemenes = [ { flag: 'skliros_sitos', eschId: CONSTANTS.ESCH_IDS.SKLIROS_SITOS }, { flag: 'malakos_sitos', eschId: CONSTANTS.ESCH_IDS.MALAKOS_SITOS }, { flag: 'vamvaki', eschId: CONSTANTS.ESCH_IDS.VAMVAKI } ];
        syndedemenes.forEach(synd => {
            if (jsonInput[synd.flag]) {
                // Βρίσκουμε τα στοιχεία του τιμολογίου από τον χρήστη ή παίρνουμε τα δοκιμαστικά.
                const cropKey = synd.flag as keyof typeof CONSTANTS.DEFAULT_VARIETIES;
                let timologioInfo = jsonInput.timologia?.find((t: any) => t.kalliergeia === cropKey);
                if (!timologioInfo) {
                    console.warn(`Δεν βρέθηκε τιμολόγιο για ${cropKey}. Δημιουργία δοκιμαστικού.`);
                    timologioInfo = CONSTANTS.DEFAULT_TIMOLOGIA[cropKey];
                }
                 // Παίρνουμε ΠΑΝΤΑ την ποικιλία από τις σταθερές.
                
                const varietyInfo = CONSTANTS.DEFAULT_VARIETIES[cropKey];
                requestsKodikosCounter++;
                const requestTempId = getTempId();
                // Δημιουργία Request
                requestChanges.push({ status: 0, when: Date.now(), entityName: 'Edetedeaeerequest', entity: { id: requestTempId, afm: afm, kodikos: requestsKodikosCounter, etos: EAE_YEAR, eschLt2: 2, recordtype: 0, edeId: { id: appId }, eschId: { id: synd.eschId }, sexId: sexIdObject } });
                
                // Δημιουργία Sporos (με τη σταθερή ποικιλία)
                requestChanges.push({ status: 0, when: Date.now(), entityName: 'Edetedeaeerequestsporo', entity: { id: getTempId(), afm: afm, kodikos: 1, etos: EAE_YEAR, recordtype: 0, sporosqty: timologioInfo.posotita, etiketes: timologioInfo.etiketes, edeId: { id: appId }, edrqId: { id: requestTempId }, eschId: { id: synd.eschId }, sexId: sexIdObject, efyId: { id: varietyInfo.efyId }, poiId: { id: varietyInfo.poiId } } });
                
                // Δημιουργία Invoice
                requestChanges.push({ status: 0, when: Date.now(), entityName: 'Edetedeaeerequestinvoice', entity: { id: getTempId(), afm: afm, kodikos: 1, etos: EAE_YEAR, recordtype: 0, timologioafm: timologioInfo.afm, timologioname: timologioInfo.epwnymia, timologiodte: timologioInfo.hmerominia, edeId: { id: appId }, edrqId: { id: requestTempId }, sexId: sexIdObject } });
            }
        });
        await executeSyncBatch(appId, requestChanges, 'MainService/synchronizeChangesWithDb_Edetedeaeehd', 'Προσθήκη Άμεσων Ενισχύσεων');
        
        // --- ΒΗΜΑ 4: Προσθήκη Οικολογικών Σχημάτων ---
        const ecoChanges: any[] = [];
        if (jsonInput.lipasmata === true) {
            const ecoTempId = getTempId();
            ecoChanges.push({ status: 0, when: Date.now(), entityName: 'Edetedeaeeeco', entity: { id: ecoTempId, afm: afm, kodikos: 1, etos: EAE_YEAR, recordtype: 0, edeId: { id: appId }, esgrId: { id: CONSTANTS.ECO_SCHEME_IDS.LIPASMATA }, sexId: sexIdObject  } });
            for (let i = 1; i <= 2; i++) { ecoChanges.push({ status: 0, when: Date.now(), entityName: 'Edetedeaeeecoinvoice', entity: { id: getTempId(), afm: afm, kodikos: i, etos: EAE_YEAR, recordtype: 0, timologioafm: " ", timologioname: " ", timologiodte: new Date().toISOString(), edeId: { id: appId }, edegId: { id: ecoTempId }, sexId: sexIdObject  } }); }
        }
        if (jsonInput.viologiko === true) {
            ecoChanges.push({ status: 0, when: Date.now(), entityName: 'Edetedeaeeeco', entity: { id: getTempId(), afm: afm, kodikos: 2, etos: EAE_YEAR, recordtype: 0, edeId: { id: appId }, esgrId: { id: CONSTANTS.ECO_SCHEME_IDS.VIOLOGIKO }, sexId: sexIdObject  } });
        }
        await executeSyncBatch(appId, ecoChanges, 'MainService/synchronizeChangesWithDb_Edetedeaeehd', 'Προσθήκη Οικολογικών Σχημάτων');
        
        // --- ΒΗΜΑ 5: Ενημέρωση GDPR ---
        const gdprIdsResp = await fetchApi('Edetedeaeegdpr/findAllByCriteriaRange_EdetedeaeehdGrpEdgdpr', { edeId_id: appId, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 2000, exc_Id: [] });
        const gdprEntities = gdprIdsResp.data || [];
        const gdprChanges = gdprEntities.map((rawGdprEntity: any) => {
            // "Καθαρίζουμε" το κάθε αντικείμενο GDPR ξεχωριστά
            const cleanedGdprEntity = prepareEntityForRequest(rawGdprEntity);
            
            // Εφαρμόζουμε την αλλαγή μας στο "καθαρό" αντικείμενο
            const entityForUpdate = {
                ...cleanedGdprEntity,
                sygkatatheshflag: 1
            };
        
            return {
                status: 1, // Update
                when: Date.now(),
                entityName: 'Edetedeaeegdpr',
                entity: entityForUpdate
            };
        });
        await executeSyncBatch(appId, gdprChanges, 'MainService/synchronizeChangesWithDb_Edetedeaeehd', 'Ενημέρωση GDPR');

        // --- ΒΗΜΑ 6: Προσθήκη Σύμβασης Ηλίανθου ---
        if (jsonInput.hlianthos_sumbasi === true) {
            const contractChanges = [{
                status: 0, when: Date.now(), entityName: 'Edetedeaeemetcom',
                entity: { id: getTempId(), afm: afm, kodikos: 1, etos: EAE_YEAR, recordtype: 0, arsymbashmet: "1", dtesymbashmet: "2024-12-31T22:00:00.000Z", contractektash: 1, edeId: { id: appId }, emcId: { id: CONSTANTS.HLIANTHOS_IDS.EMC_ID }, efecId: { id: CONSTANTS.HLIANTHOS_IDS.EFEC_ID } }
            }];
            await executeSyncBatch(appId, contractChanges, 'MainService/synchronizeChangesWithDb_Edetedeaeemetcom', 'Προσθήκη Σύμβασης Ηλίανθου');
        }

        // --- ΒΗΜΑ 7: Προσθήκη Δικαιολογητικών ---
        const dikaiologitikaResp = await fetchApi('Edetedeaeedikaiol/findAllByCriteriaRange_EdetedeaeedikaiolGrpEdl_count', { g_Ede_id: appId, gParams_yearEae: EAE_YEAR, exc_Id: [] });
        let dikKodikosCounter = dikaiologitikaResp.count;
        const dikChanges: any[] = [];
        const addDikaiologitiko = (edkId: string) => { dikKodikosCounter++; dikChanges.push({ status: 0, when: Date.now(), entityName: 'Edetedeaeedikaiol', entity: { id: getTempId(), afm: afm, kodikos: dikKodikosCounter, etos: EAE_YEAR, recordtype: 0, fileYear: EAE_YEAR, edeId: { id: appId }, edkId: { id: edkId } } }); };
        
        addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TAYTOPROSOPIA);
        if (jsonInput.skliros_sitos === true) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.KARTELA_SKLIROY); addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TIMOLOGIO_SKLIROY); }
        if (jsonInput.malakos_sitos === true) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.KARTELA_MALAKOY); addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TIMOLOGIO_MALAKOY); }
        if (jsonInput.vamvaki === true) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.KARTELA_VAMVAKIOY); addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TIMOLOGIO_VAMVAKIOY); }
        if (jsonInput.lipasmata === true) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.LIPASMATA); }
        if (jsonInput.akrofysia === true) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.AKROFYSIA); }
        
        await executeSyncBatch(appId, dikChanges, 'MainService/synchronizeChangesWithDb_Edetedeaeedikaiol', 'Προσθήκη Δικαιολογητικών');

        alert("Η μαζική ενημέρωση ολοκληρώθηκε με επιτυχία!");

    } catch (error) {
        console.error("--- ΚΡΙΣΙΜΟ ΣΦΑΛΜΑ ΚΑΤΑ ΤΗ ΜΑΖΙΚΗ ΕΝΗΜΕΡΩΣΗ ---", error);
        alert(`Προέκυψε σφάλμα: ${(error as Error).message}`);
    } finally {
        document.body.style.cursor = 'default';
        console.log("--- Τέλος Μαζικής Ενημέρωσης ---");
    }
}