import { fetchApi, executeSync, EAE_YEAR } from './api';

/**
 * Handles the mass update, creation, and deletion of ownership records based on JSON input.
 * @param appId The main application ID (edeId).
 * @param jsonInput An array of ownership change objects.
 */
export async function handleOwnershipRefresh(appId: string, jsonInput: any[]) {
    console.log(`--- Έναρξη Μαζικής Ανανέωσης Ιδιοκτησιών για την αίτηση ${appId} ---`);
    document.body.style.cursor = 'wait';

    try {
        // --- ΒΗΜΑ 1: Ανάκτηση Βοηθητικών Δεδομένων --- 
        console.log("Βήμα 1: Ανάκτηση βοηθητικών δεδομένων (Τύποι Ιδιοκτησίας, Αγροτεμάχια)... ");
        const [titleResponse, allAgrotemaxiaResponse, edehdResponse] = await Promise.all([
            fetchApi('Edetitle/findAllByCriteriaRange_forLov', { gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 100 }),
            fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', { g_Ede_id: appId, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 1000 }),
            fetchApi('Edetedeaeehd/findById', { id: appId })
        ]);

        const titleMap = new Map(titleResponse.data.map((title: any) => [title.kodikos, { id: title.id, iemtype: title.iemtype }]));
        const agrotemaxiaMap = new Map(allAgrotemaxiaResponse.data.map((agro: any) => [String(agro.kodikos), agro]));
        const applicantAfm = edehdResponse.data[0].afm;
        console.log("  -> Ολοκληρώθηκε.");

        // --- ΒΗΜΑ 2: Επεξεργασία Εισόδου και Δημιουργία Λίστας Αλλαγών --- 
        console.log("Βήμα 2: Επεξεργασία JSON εισόδου...");
        const changes = [];

        for (const item of jsonInput) {
            const agro = agrotemaxiaMap.get(String(item.kodikos_agrotemaxiou));
            if (!agro) {
                console.warn(`! Παράλειψη: Δεν βρέθηκε αγροτεμάχιο με κωδικό ${item.kodikos_agrotemaxiou}`);
                continue;
            }

            const ownershipTitle = titleMap.get(String(item.iemtype_kodikos));
            if (!ownershipTitle) {
                console.warn(`! Παράλειψη: Δεν βρέθηκε τύπος ιδιοκτησίας με κωδικό ${item.iemtype_kodikos}`);
                continue;
            }

            const existingOwnerships = (await fetchApi('Edetedeaeeagroiem/findAllByCriteriaRange_EdetedeaeeagroiGrpEam', {
                edaId_id: agro.id,
                gParams_yearEae: EAE_YEAR,
                fromRowIndex: 0,
                toRowIndex: 50,
                exc_Id: []
            })).data || [];

            let kodikos = 1;
            if (item.status === 0) { // Create
                const maxKodikos = existingOwnerships.reduce((max, o) => Math.max(max, o.kodikos), 0);
                kodikos = maxKodikos + 1;
            }

            let aatemparastatiko = item.aatemparastatiko;
            if (aatemparastatiko === 0) {
                const ownerOwnerships = existingOwnerships.filter(o => o.afmidiokthth === item.afmidiokthth);
                aatemparastatiko = ownerOwnerships.length + 1;
            }

            const entity: any = {
                id: item.id || `TEMP_ID_${Math.random().toString(36).substr(2, 9)}`,
                afm: applicantAfm,
                recordtype: item.status === 1 ? (item.rowVersion || 0) + 2 : 0,
                rowVersion: item.status === 1 ? item.rowVersion : null,
                kodikos: item.kodikos || kodikos,
                afmidiokthth: item.afmidiokthth,
                nameidiokthth: item.nameidiokthth,
                synidiopercent: item.synidiopercent,
                iemtype: ownershipTitle.iemtype,
                atak: item.atak,
                ektashAtak: item.ektashAtak,
                dteenoikstart: item.dteenoikstart || null,
                dteenoikend: item.dteenoikend || null,
                aatemparastatiko: aatemparastatiko,
                etos: EAE_YEAR,
                edeId: { id: appId },
                edaId: { id: agro.id },
                etlId: { id: ownershipTitle.id },
            };

            changes.push({
                status: item.status,
                when: Date.now(),
                entityName: "Edetedeaeeagroiem",
                entity
            });
        }
        console.log(`  -> Δημιουργήθηκαν ${changes.length} αλλαγές.`);

        // --- ΒΗΜΑ 3: Αποστολή στη Βάση --- 
        if (changes.length === 0) {
            alert('Δεν προέκυψαν έγκυρες αλλαγές για αποθήκευση.');
            return;
        }

        console.log("Βήμα 3: Αποστολή αλλαγών στον server...");
        await executeSync(changes, appId);
        alert(`Η μαζική ανανέωση ιδιοκτησιών ολοκληρώθηκε με επιτυχία!`);

    } catch (error) {
        console.error("--- ΚΡΙΣΙΜΟ ΣΦΑΛΜΑ ΚΑΤΑ ΤΗ ΜΑΖΙΚΗ ΑΝΑΝΕΩΣΗ ΙΔΙΟΚΤΗΣΙΩΝ ---", error);
        alert(`Προέκυψε σφάλμα: ${(error as Error).message}`);
    } finally {
        document.body.style.cursor = 'default';
        console.log("--- Τέλος Μαζικής Ανανέωσης Ιδιοκτησιών ---");
    }
}
