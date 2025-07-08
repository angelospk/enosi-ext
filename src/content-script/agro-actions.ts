import {
    fetchApi,
    synchronizeChanges,
    executeSync,
    EAE_YEAR
} from '../utils/api';

/**
     * Fetches the AFM for a given mainApplicationId.
     * @param mainApplicationId - The main application ID (edeId).
     * @returns {Promise<string|null>} The AFM if found, otherwise null.
     */
export async function getAfmForApplication(mainApplicationId: string): Promise<string | null> {
    if (!mainApplicationId) {
        alert("ID Αίτησης δεν έχει οριστεί. Ανανεώστε τη σελίδα πάνω σε μια αίτηση.");
        return null;
    }
    try {
        const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: mainApplicationId });
        const currentEdehd = edehdResponse.data[0];
        return currentEdehd?.afm ?? null;
    } catch (e) {
        console.error("Σφάλμα κατά την ανάκτηση του AFM:", e);
        return null;
    }
}

/**
 * Copies crop, cultivation, and eco-scheme data from a source parcel to multiple target parcels.
 * @param mainApplicationId - The main application ID (edeId).
 */
export async function copyAgrotemaxioData(mainApplicationId: string) {
    if (!mainApplicationId) {
        alert("ID Αίτησης δεν έχει οριστεί. Ανανεώστε τη σελίδα πάνω σε μια αίτηση.");
        return;
    }

    try {
        // --- 0. Επιβεβαίωση Χρήστη ---
        const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: mainApplicationId });
        const currentEdehd = edehdResponse.data[0];
        const confirmMessage = `Ενέργεια: Αντιγραφή Καλλιεργειών & Οικολογικών Σχημάτων\n\nΑίτηση:\nAFM: ${currentEdehd.afm}\nΌνομα: ${currentEdehd.firstname}\nΕπώνυμο: ${currentEdehd.lastname}\n\nΠατήστε ΟΚ για να συνεχίσετε.`;
        if (!window.confirm(confirmMessage)) {
            alert("Η διαδικασία ακυρώθηκε από τον χρήστη.");
            return;
        }

        //αποθήκευση κωδικών που είχαν σφάλματα
        const errors = [];
        // --- 1. Λήψη όλων των αγροτεμαχίων ---
        console.log("Fetching all agrotemaxia...");
        const allAgrotemaxiaResponse = await fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', { g_Ede_id: mainApplicationId, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 1000 });
        const agrotemaxiaMap = new Map(allAgrotemaxiaResponse.data.map((agro: any) => [String(agro.kodikos), agro]));
        const availableKodikoi = Array.from(agrotemaxiaMap.keys()).join(', ');
        console.log(`Available agrotemaxio kodikoi: ${availableKodikoi}`);

        // --- 2. Είσοδος Πηγής και Στόχων ---
        const sourceKodikos = prompt(`Εισάγετε τον ΚΩΔΙΚΟ του αγροτεμαχίου-ΠΗΓΗΣ.\nΔιαθέσιμοι: ${availableKodikoi}`);
        if (!sourceKodikos || !agrotemaxiaMap.has(sourceKodikos)) {
            alert(`Σφάλμα: το αγροτεμάχιο-πηγή με κωδικό '${sourceKodikos}' δεν βρέθηκε.`);
            return;
        }
        const sourceAgrotemaxio: any = agrotemaxiaMap.get(sourceKodikos);

        const targetKodikoiInput = prompt(`Εισάγετε τους ΚΩΔΙΚΟΥΣ των αγροτεμαχίων-ΣΤΟΧΩΝ, χωρισμένους με κόμμα (π.χ. 2, 3, 4):`);
        if (!targetKodikoiInput) {
            alert("Σφάλμα: Δεν δόθηκαν αγροτεμάχια-στόχοι.");
            return;
        }
        const targetKodikoi = targetKodikoiInput.replaceAll(";", ",").split(',').map(k => k.trim()).filter(k => k);

        // --- 3. Ανάκτηση ΟΛΩΝ των Δεδομένων Πηγής ---
        console.log(`Fetching ALL data from source agrotemaxio (kodikos: ${sourceKodikos})...`);
        const sourceFytikoResponse = await fetchApi('Edetedeaeefytiko/findAllByCriteriaRange_EdetedeaeeagroiGrpEdf', { edaId_id: sourceAgrotemaxio.id, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 10 });
        const sourceFytiko = (sourceFytikoResponse.data && sourceFytikoResponse.data.length > 0) ? sourceFytikoResponse.data[0] : null;

        let sourceSyndedemeni = null;
        if (sourceFytiko) {
            const sourceSyndedemeniResponse = await fetchApi('Edetedeaeerequestfytiko/findAllByCriteriaRange_EdetedeaeeagroiGrpEfrq', { edfId_id: sourceFytiko.id, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 10 });
            sourceSyndedemeni = (sourceSyndedemeniResponse.data && sourceSyndedemeniResponse.data.length > 0) ? sourceSyndedemeniResponse.data[0] : null;
        }

        const sourceEcoSchemesResponse = await fetchApi('Edetedeaeeagroieco/findAllByCriteriaRange_EdetedeaeeagroiGrpEdaec', { edaId_id: sourceAgrotemaxio.id, fromRowIndex: 0, toRowIndex: 500 });
        const sourceEcoSchemes = sourceEcoSchemesResponse.data || [];
        console.log(`Source has ${sourceEcoSchemes.length} eco-schemes.`);

        // --- 4. Loop για κάθε Στόχο ---
        console.log("--- Starting Copy Process ---");
        for (const targetKodikos of targetKodikoi) {
            console.log(`\n--- Processing Target Kodikos: ${targetKodikos} ---`);
            if (!agrotemaxiaMap.has(targetKodikos) || sourceKodikos === targetKodikos) {
                console.error(`Invalid or same-as-source target kodikos '${targetKodikos}'. Skipping.`);
                continue;
            }
            const targetAgrotemaxio: any = agrotemaxiaMap.get(targetKodikos);

            try {
                // ΕΠΕΞΕΡΓΑΣΙΑ ΚΑΛΛΙΕΡΓΕΙΑΣ & ΣΥΝΔΕΔΕΜΕΝΗΣ
                if (sourceFytiko) {
                    console.log(`Processing Kalliergia/Syndedemeni for target ${targetKodikos}...`);
                    const targetFytikoResponse = await fetchApi('Edetedeaeefytiko/findAllByCriteriaRange_EdetedeaeeagroiGrpEdf', { edaId_id: targetAgrotemaxio.id, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 10 });
                    const targetFytiko = (targetFytikoResponse.data && targetFytikoResponse.data.length > 0) ? targetFytikoResponse.data[0] : null;

                    if (targetFytiko) {
                        const changes = [];

                        // ΒΗΜΑ 5.1: Έλεγχος και προετοιμασία διαγραφής παλιάς συνδεδεμένης του TARGET
                        const targetSyndedemenes = await fetchApi('Edetedeaeerequestfytiko/findAllByCriteriaRange_EdetedeaeeagroiGrpEfrq', { edfId_id: targetFytiko.id, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 10 });
                        if (targetSyndedemenes.data && targetSyndedemenes.data.length > 0) {
                            console.log(`Target ${targetKodikos} has existing syndedemenes. They will be deleted.`);
                            for (const synd of targetSyndedemenes.data) {
                                changes.push({
                                    status: 2, // Delete
                                    when: Date.now(),
                                    entityName: "Edetedeaeerequestfytiko",
                                    entity: { id: synd.id, rowVersion: synd.rowVersion }
                                });
                            }
                        }

                        // ΒΗΜΑ 5.2: Προετοιμασία Ανανέωσης του Φυτικού Κεφαλαίου του TARGET
                        const updatedFytikoEntity = {
                            ...targetFytiko,
                                      efyId: { id: sourceFytiko.efyId.id },
        poiId: { id: sourceFytiko.poiId.id },
        emxpId: sourceFytiko.emxpId ? { id: sourceFytiko.emxpId.id } : null,
        emccId: sourceFytiko.emccId ? { id: sourceFytiko.emccId.id } : null,
        efecId: sourceFytiko.efecId ? { id: sourceFytiko.efecId.id } : null,
                        };
                        changes.push({
                            status: 1, // Update
                            when: Date.now(),
                            entityName: "Edetedeaeefytiko",
                            entity: updatedFytikoEntity
                        });

                        // ΒΗΜΑ 5.3: Προετοιμασία Προσθήκης ΝΕΑΣ Συνδεδεμένης (αν υπάρχει στην πηγή)
                        if (sourceSyndedemeni && sourceSyndedemeni.eschId && sourceSyndedemeni.eschId.id) {
                            const edehdResponseForSexId = await fetchApi('Edetedeaeehd/findById', { id: mainApplicationId });
                            const userSexId = edehdResponseForSexId.data[0].sexId.id || edehdResponseForSexId.data[0].sexId.$refId;

                            if (!userSexId) throw new Error("Could not determine user's Subscriber ID.");

                            const newRequestFytikoEntity = {
                                id: `TEMP_ID_${Date.now()}`,
                                afm: sourceAgrotemaxio.afm,
                                kodikos: 1, // Ξεκινάμε από 1 αφού διαγράψαμε τις παλιές
                                etos: EAE_YEAR,
                                edeId: { id: mainApplicationId },
                                edaId: { id: targetAgrotemaxio.id },
                                edfId: { id: targetFytiko.id }, // Σύνδεση με το fytiko του target
                                efyId: { id: sourceFytiko.efyId.id },
                                poiId: { id: sourceFytiko.poiId.id },
                                eschId: { id: sourceSyndedemeni.eschId.id },
                                sexId: { id: userSexId },
                                // Τα υπόλοιπα πεδία θα είναι null ή default
                                recordtype: 0, eschLt2: 2, rowVersion: null,
                                usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                            };
                            changes.push({
                                status: 0, // Create
                                when: Date.now(),
                                entityName: "Edetedeaeerequestfytiko",
                                entity: newRequestFytikoEntity
                            });
                        } else {
                            console.log("Source agrotemaxio has no syndedemeni to copy.");
                        }

                        // ΒΗΜΑ 5.4: Προετοιμασία του Edetedeaeehd
                        const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: mainApplicationId });
                        const currentEdehd = edehdResponse.data[0];
                        changes.push({
                            status: 1,
                            when: 0,
                            entityName: "Edetedeaeehd",
                            entity: { ...currentEdehd, rowVersion: currentEdehd.rowVersion + 2 }
                        });

                        // ΒΗΜΑ 5.5: Αποστολή του ενιαίου batch
                        console.log(`Sending combined Delete/Update/Create request for target ${targetKodikos}...`);
                        await synchronizeChanges(changes);
                        console.log(`Kalliergia/Syndedemeni for target ${targetKodikos} processed successfully.`);

                    } else {
                        console.warn(`Target ${targetKodikos} has no fytiko to update. Skipping kalliergia copy.`);
                    }
                }

                // ΕΠΕΞΕΡΓΑΣΙΑ ΟΙΚΟΛΟΓΙΚΩΝ ΣΧΗΜΑΤΩΝ
                if (sourceEcoSchemes.length > 0) {
                    console.log(`Processing Eco-Schemes for target ${targetKodikos}...`);

                    // Έλεγχος αν το target έχει ήδη οικολογικά σχήματα. Αν ναι, τα παρακάμπτουμε.
                    const targetEcoSchemes = await fetchApi('Edetedeaeeagroieco/findAllByCriteriaRange_EdetedeaeeagroiGrpEdaec', { edaId_id: targetAgrotemaxio.id, fromRowIndex: 0, toRowIndex: 500 });
                    if (targetEcoSchemes.data && targetEcoSchemes.data.length > 0) {
                        console.warn(`Target ${targetKodikos} already has eco-schemes. Skipping eco-scheme copy to avoid duplicates.`);
                    } else {
                        // Το target είναι "καθαρό", οπότε προχωράμε στην προσθήκη
                        const ecoChanges = [];
                        let ecoKodikosCounter = 0;

                        for (const srcEco of sourceEcoSchemes) {
                            ecoKodikosCounter++;
                            const newEcoEntity = {
                                id: `TEMP_ID_ECO_${Date.now()}_${ecoKodikosCounter}`,
                                afm: sourceAgrotemaxio.afm,
                                recordtype: 0,
                                usrinsert: null, dteinsert: null, usrupdate: null, dteupdate: null,
                                kodikos: ecoKodikosCounter,
                                sexId: null, // Όπως στο επιτυχημένο request
                                rowVersion: null,
                                esruId: null,
                                datasourcetype: 2,
                                etos: EAE_YEAR,
                                edeId: { id: mainApplicationId },
                                edaId: { id: targetAgrotemaxio.id },
                                essuId: { id: srcEco.essuId.id } // Παίρνουμε το ID από την πηγή
                            };
                            ecoChanges.push({
                                status: 0,
                                when: Date.now(),
                                entityName: "Edetedeaeeagroieco",
                                entity: newEcoEntity
                            });
                        }

                        // Προσθήκη του Edetedeaeehd στο τέλος του batch
                        const edehdResponseForEco = await fetchApi('Edetedeaeehd/findById', { id: mainApplicationId });
                        const currentEdehdForEco = edehdResponseForEco.data[0];
                        ecoChanges.push({
                            status: 1,
                            when: 0,
                            entityName: "Edetedeaeehd",
                            entity: {
                                ...currentEdehdForEco,
                                rowVersion: currentEdehdForEco.rowVersion + 2
                            }
                        });

                        console.log(`Sending ${ecoChanges.length - 1} new eco-scheme(s) for target ${targetKodikos}...`);
                        await synchronizeChanges(ecoChanges);
                        console.log(`Eco-schemes for target ${targetKodikos} processed successfully.`);
                    }
                }

            } catch (error) {
                errors.push(targetKodikos);
                console.error(`Failed to process target kodikos: ${targetKodikos}. Error: ${(error as Error).message}`);
            }
        }

        alert(`Η αντιγραφή ολοκληρώθηκε. Υπάρχουν ${errors.length} σφάλματα στους στόχους: ${errors.join(', ')}`);

    } catch (error) {
        alert(`Προέκυψε κρίσιμο σφάλμα: ${(error as Error).message}`);
        console.error("Full error details:", error);
    }
}


/**
 * Copies the bioflag value from a source parcel to multiple target parcels.
 * @param mainApplicationId - The main application ID (edeId).
 */
export async function copyBioflagToTargets(mainApplicationId: string) {
    if (!mainApplicationId) {
        alert("ID Αίτησης δεν έχει οριστεί. Ανανεώστε τη σελίδα πάνω σε μια αίτηση.");
        return;
    }

    try {
        // --- 1. Λήψη Βασικών Πληροφοριών & Αγροτεμαχίων ---
        console.log("Fetching all agrotemaxia for bioflag copy...");
        const allAgrotemaxiaResponse = await fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', {
            g_Ede_id: mainApplicationId,
            gParams_yearEae: EAE_YEAR,
            fromRowIndex: 0,
            toRowIndex: 1000
        });
        const agrotemaxiaMap = new Map(allAgrotemaxiaResponse.data.map((agro: any) => [String(agro.kodikos), agro]));
        const availableKodikoi = Array.from(agrotemaxiaMap.keys()).join(', ');
        console.log(`Available agrotemaxio kodikoi: ${availableKodikoi}`);

        // --- 2. Είσοδος Πηγής και Στόχων ---
        const sourceKodikos = prompt(`Εισάγετε τον ΚΩΔΙΚΟ του αγροτεμαχίου-ΠΗΓΗΣ για το bioflag.`);
        if (!sourceKodikos || !agrotemaxiaMap.has(sourceKodikos)) {
            alert(`Σφάλμα: το αγροτεμάχιο-πηγή με κωδικό '${sourceKodikos}' δεν βρέθηκε.`);
            return;
        }
        const sourceAgrotemaxio: any = agrotemaxiaMap.get(sourceKodikos);
        const bioflagToCopy = sourceAgrotemaxio.bioflag;
        // alert(`Η τιμή του bioflag που θα αντιγραφεί από τον κωδικό ${sourceKodikos} είναι: ${bioflagToCopy}`);

        const targetKodikoiInput = prompt(`Εισάγετε τους ΚΩΔΙΚΟΥΣ των αγροτεμαχίων-ΣΤΟΧΩΝ, χωρισμένους με κόμμα:`);
        if (!targetKodikoiInput) {
            alert("Σφάλμα: Δεν δόθηκαν αγροτεμάχια-στόχοι.");
            return;
        }
        const targetKodikoi = targetKodikoiInput.split(',').map(k => k.trim()).filter(k => k);

        // --- 3. Δημιουργία του πίνακα αλλαγών (changes) ---
        const changesToExecute: any[] = [];
        for (const kodikos of targetKodikoi) {
            if (!agrotemaxiaMap.has(kodikos)) {
                console.warn(`Ο στόχος με κωδικό ${kodikos} δεν βρέθηκε. Παράβλεψη.`);
                continue;
            }
            if (kodikos === sourceKodikos) {
                console.warn(`Ο στόχος ${kodikos} είναι ίδιος με την πηγή. Παράβλεψη.`);
                continue;
            }

            const targetAgrotemaxio: any = agrotemaxiaMap.get(kodikos);
            if (targetAgrotemaxio.bioflag === bioflagToCopy) {
                console.log(`Ο στόχος ${kodikos} έχει ήδη τη σωστή τιμή bioflag (${bioflagToCopy}). Παράβλεψη.`);
                continue;
            }

            const updateEntity = {
                ...targetAgrotemaxio,
                bioflag: bioflagToCopy
            };

            changesToExecute.push({
                status: 1, // Update
                entityName: "Edetedeaeeagroi",
                entity: updateEntity
            });
        }

        // --- 4. Έλεγχος και Εκτέλεση ---
        if (changesToExecute.length === 0) {
            alert("Δεν απαιτούνται αλλαγές. Όλοι οι στόχοι είχαν ήδη τη σωστή τιμή ή ήταν άκυροι.");
            return;
        }

        // alert(`Προετοιμασία για την ενημέρωση του bioflag σε ${changesToExecute.length} αγροτεμάχια.`);
        
        const result = await executeSync(changesToExecute, mainApplicationId);

        alert("Η διαδικασία ενημέρωσης του bioflag ολοκληρώθηκε με επιτυχία!");
        console.log("Server Response:", result);

    } catch (error) {
        alert(`Προέκυψε σφάλμα κατά την αντιγραφή του bioflag: ${(error as Error).message}`);
        console.error("Full error details:", error);
    }
} 