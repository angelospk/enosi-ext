function copyAttributes(item: any, target: any) {
    item.id = target.id;
    item.recordtype = target.recordtype;
    item.aatemparastatiko = target.aatemparastatiko;
    item.sexId = target.sexId;
    item.usrinsert = target.usrinsert;
    item.usrupdate = target.usrupdate;
    item.dteinsert = target.dteinsert;
    item.dteupdate = target.dteupdate;
    item.rowVersion = target.rowVersion;
    return item;
}

import { fetchApi, executeSync, EAE_YEAR } from './api';

/**
 * Handles the mass update, creation, and deletion of ownership records based on JSON input.
 * @param appId The main application ID (edeId).
 * @param jsonInput An array of ownership change objects.
 */
export async function handleOwnershipRefresh(appId: string, jsonInput: any[]) {
    console.log(`--- Έναρξη Μαζικής Ανανέωσης Ιδιοκτησιών για την αίτηση ${appId} ---`);
    document.body.style.cursor = 'wait';
    let warns: any[] = [];
    const changes: any[] = [];

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

        // --- ΒΗΜΑ 2: Ομαδοποίηση αλλαγών ανά αγροτεμάχιο ---
        const groupedByParcel = jsonInput.reduce((acc, item) => {
            const key = item.kodikos_agrotemaxiou;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(item);
            return acc;
        }, {} as Record<string, any[]>);

        console.log("Βήμα 2: Επεξεργασία JSON εισόδου ανά αγροτεμάχιο...");

        for (const kodikos_agrotemaxiou in groupedByParcel) {
            const agro = agrotemaxiaMap.get(String(kodikos_agrotemaxiou));
            if (!agro) {
                console.warn(`! Παράλειψη: Δεν βρέθηκε αγροτεμάχιο με κωδικό ${kodikos_agrotemaxiou}`);
                warns.push(...groupedByParcel[kodikos_agrotemaxiou]);
                continue;
            }

            // Ανάκτηση ιδιοκτησιών ΜΙΑ φορά για κάθε αγροτεμάχιο
            const existingOwnerships = (await fetchApi('Edetedeaeeagroiem/findAllByCriteriaRange_EdetedeaeeagroiGrpEam', {
                edaId_id: agro.id,
                gParams_yearEae: EAE_YEAR,
                fromRowIndex: 0,
                toRowIndex: 100, // Increased limit for safety
                exc_Id: []
            })).data || [];

            const itemsForParcel = groupedByParcel[kodikos_agrotemaxiou];

            for (let item of itemsForParcel) {
                const ownershipTitle = titleMap.get(String(item.iemtype_kodikos));
                if (!ownershipTitle) {
                    console.warn(`! Παράλειψη: Δεν βρέθηκε τύπος ιδιοκτησίας με κωδικό ${item.iemtype_kodikos} για το αγροτεμάχιο ${kodikos_agrotemaxiou}`);
                    warns.push(item);
                    continue;
                }

                let entity: any;
                let found = false;
                let existingOwnershipForAction: any = null;


                if (item.status === 0) { // Create
                    const maxKodikos = existingOwnerships.reduce((max, o) => Math.max(max, o.kodikos), 0);
                    item.kodikos = maxKodikos + 1;

                    if (item.aatemparastatiko === 0) {
                        const ownerOwnerships = existingOwnerships.filter(o => o.afmidiokthth === item.afmidiokthth);
                        item.aatemparastatiko = ownerOwnerships.length + 1;
                    }
                    
                    entity = { ...item };
                    found = true;

                } else if (item.status === 2) { // Delete
                    const ownerOwnerships = existingOwnerships.filter(o => o.afmidiokthth === item.afmidiokthth);
                    existingOwnershipForAction = ownerOwnerships.find(o => o.atak === item.atak) || ownerOwnerships.find(o => o.ektashAtak === item.ektashAtak);
                    
                    if (existingOwnershipForAction) {
                        item = copyAttributes(item, existingOwnershipForAction);
                        entity = { ...item };
                        found = true;
                        // Remove from local list to handle kodikos correctly for next items
                        const index = existingOwnerships.findIndex(o => o.id === existingOwnershipForAction.id);
                        if (index > -1) {
                            existingOwnerships.splice(index, 1);
                        }
                    }
                } else if (item.status === 1) { // Update
                    existingOwnershipForAction = existingOwnerships.find(o => o[item.same] === item[item.same]);
                    if (existingOwnershipForAction) {
                        item = copyAttributes(item, existingOwnershipForAction);
                        entity = { ...item };
                        found = true;
                    }
                }

                if (!found) {
                    console.warn(`! Παράλειψη: Δεν βρέθηκε αντιστοίχιση για update/delete στο αγροτεμάχιο ${kodikos_agrotemaxiou}:`, item);
                    warns.push(item);
                    continue;
                }

                const finalEntity: any = {
                    id: entity.id || `TEMP_ID_${Math.random().toString(36).substr(2, 9)}`,
                    afm: applicantAfm,
                    recordtype: entity.status === 0 ? 0 : entity.recordtype || 0,
                    rowVersion: entity.status === 0 ? null : (entity.rowVersion || 0) + 2,
                    kodikos: entity.kodikos,
                    afmidiokthth: entity.afmidiokthth,
                    nameidiokthth: entity.nameidiokthth,
                    synidiopercent: entity.synidiopercent,
                    iemtype: ownershipTitle.iemtype,
                    atak: entity.atak,
                    ektashAtak: entity.ektashAtak,
                    dteenoikstart: entity.dteenoikstart || null,
                    dteenoikend: entity.dteenoikend || null,
                    aatemparastatiko: entity.aatemparastatiko,
                    etos: EAE_YEAR,
                    edeId: { id: appId },
                    edaId: { id: agro.id },
                    etlId: { id: ownershipTitle.id },
                };
                if (entity.status !== 0) {
                    finalEntity.sexId = entity.sexId;
                }

                changes.push({
                    status: item.status,
                    when: Date.now(),
                    entityName: "Edetedeaeeagroiem",
                    entity: finalEntity
                });

                // Add new entity to local list for correct kodikos calculation in next iteration
                if (item.status === 0) {
                    existingOwnerships.push(finalEntity);
                }
            }
        }

        console.log(`  -> Δημιουργήθηκαν ${changes.length} αλλαγές.`);

        // --- ΒΗΜΑ 3: Αποστολή στη Βάση ---
        if (changes.length === 0) {
            alert('Δεν προέκυψαν έγκυρες αλλαγές για αποθήκευση.');
            return;
        }

        console.log("Βήμα 3: Αποστολή αλλαγών στον server μία προς μία...");
        let successCount = 0;
        let errorCount = 0;
        for (const change of changes) {
            try {
                await executeSync([change], appId);
                successCount++;
            } catch (error) {
                errorCount++;
                console.error(`Απέτυχε η αποθήκευση για την αλλαγή:`, change, error);
            }
        }
        alert(`Η μαζική ανανέωση ιδιοκτησιών ολοκληρώθηκε.\nΕπιτυχείς αλλαγές: ${successCount}\nΑποτυχημένες αλλαγές: ${errorCount}`);

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