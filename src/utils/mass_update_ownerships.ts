function copyAttributes(item, target) {
    item.id = target.id;
    item.recordtype=target.recordtype;
    item.aatemparastatiko=target.aatemparastatiko;
    item.sexId=target.sexId;
    item.usrinsert=target.usrinsert;
    item.usrupdate=target.usrupdate;
    item.dteinsert=target.dteinsert;
    item.dteupdate=target.dteupdate;
    item.rowVersion = target.rowVersion;
    return item;
}
import { writeHeapSnapshot } from 'v8';
import { fetchApi, executeSync, EAE_YEAR } from './api';

/**
 * Handles the mass update, creation, and deletion of ownership records based on JSON input.
 * @param appId The main application ID (edeId).
 * @param jsonInput An array of ownership change objects.
 */
export async function handleOwnershipRefresh(appId: string, jsonInput: any[]) {
    console.log(`--- Έναρξη Μαζικής Ανανέωσης Ιδιοκτησιών για την αίτηση ${appId} ---`);
    document.body.style.cursor = 'wait';
    let warns=[];

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

        for (let item of jsonInput) {
            const agro = agrotemaxiaMap.get(String(item.kodikos_agrotemaxiou));
            if (!agro) {
                console.warn(`! Παράλειψη: Δεν βρέθηκε αγροτεμάχιο με κωδικό ${item.kodikos_agrotemaxiou}`);
                warns.push(item);
                continue;
            }

            const ownershipTitle = titleMap.get(String(item.iemtype_kodikos));
            if (!ownershipTitle) {
                console.warn(`! Παράλειψη: Δεν βρέθηκε τύπος ιδιοκτησίας με κωδικό ${item.iemtype_kodikos}`);
                warns.push(item);
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

            const aatemparastatiko = item.aatemparastatiko;
            // let rowVersion=0;
            if (aatemparastatiko === 0) {
                const ownerOwnerships = existingOwnerships.filter(o => o.afmidiokthth === item.afmidiokthth);
                item.aatemparastatiko = ownerOwnerships.length + 1;

            }
            if (item.status === 2  ) {
                const ownerOwnerships = existingOwnerships.filter(o => o.afmidiokthth === item.afmidiokthth);
                //try to find the specific ownership to update
                if (ownerOwnerships.length > 0) {
                    //check if item.atak is in  any of the existingOwnerships
                    const existingOwnership = ownerOwnerships.find(o => o.atak === item.atak);
                    if (existingOwnership) {
                        item=copyAttributes(item, existingOwnership);
                    }
                    else{
                        //check if item.ektashAtak is in  any of the existingOwnerships
                        const existingOwnership = ownerOwnerships.find(o => o.ektashAtak === item.ektashAtak);
                        if (existingOwnership) {
                            item=copyAttributes(item, existingOwnership);
                        }
                        else{
                            //report that no match is found
                            console.warn(`No match found for item: ${JSON.stringify(item)}`);
                            warns.push(item);
                            continue;
                        }
                    }
                        
                    
                // rowVersion = ownerOwnerships.length + 2;
            }}

            if (item.status === 1) {
            const existingOwnership = existingOwnerships.find(o => o[item.same] === item[item.same]);
            if (existingOwnership) {
                item=copyAttributes(item, existingOwnership);

            }
            else{
                console.warn(`No match found for item: ${JSON.stringify(item)}`);
                warns.push(item);
                continue;
            }
        }

            const entity: any = {
                id: item.id || `TEMP_ID_${Math.random().toString(36).substr(2, 9)}`,
                afm: applicantAfm,
                recordtype: item.status === 0 ? 0 :item.recordtype || 0,
                rowVersion: item.status === 0 ? null : item.rowVersion + 2 ,
                kodikos: item.kodikos || kodikos,
                afmidiokthth: item.afmidiokthth,
                nameidiokthth: item.nameidiokthth,
                synidiopercent: item.synidiopercent,
                iemtype: ownershipTitle.iemtype,
                atak: item.atak,
                ektashAtak: item.ektashAtak,
                dteenoikstart: item.dteenoikstart || null,
                dteenoikend: item.dteenoikend || null,
                aatemparastatiko: item.aatemparastatiko,
                etos: EAE_YEAR,
                edeId: { id: appId },
                edaId: { id: agro.id },
                etlId: { id: ownershipTitle.id },
            };
            if (item.status !== 0) {
                entity.sexId = item.sexId;

            }
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
        if (warns.length > 0) {
            alert(`Προσοχή! Δεν βρέθηκαν αντιστοιχίσεις για τα ακόλουθα αγροτεμαχία:\n${JSON.stringify(warns)}`);
        }
    }
}
