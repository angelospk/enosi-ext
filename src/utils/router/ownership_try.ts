// src/utils/ownershipCopier.ts

import { EAE_YEAR, fetchApi, executeSync } from '../api_helpers';

// Interface για τις παραμέτρους του ΚΕΑ για καλύτερη οργάνωση
interface KeaParams {
    gUserType: string;
    globalUserVat: string;
    e_bi_gSubExt_id: string;
}

/**
 * Retrieves KEA parameters and producer AFM from sessionStorage,
 * or prompts the user if they are not found.
 * @returns An object containing the KEA parameters and the producer's AFM, or null if the user cancels.
 */
async function getOrPromptForRequiredIds(): Promise<{ keaParams: KeaParams; producerAfm: string } | null> {
    // let producerAfm = sessionStorage.getItem('ownershipCopier_afm');
    // let keaParamsJson = sessionStorage.getItem('ownershipCopier_keaParams');
    let producerAfm;
    let keaParamsJson;
    let keaParams: KeaParams | null = keaParamsJson ? JSON.parse(keaParamsJson) : null;

    // Ζητάμε το ΑΦΜ του παραγωγού αν δεν υπάρχει
    if (!producerAfm) {
        producerAfm = prompt("Εισάγετε το ΑΦΜ του παραγωγού για τον οποίο θέλετε να κάνετε την αντιγραφή:");
        if (!producerAfm) {
            console.log("[OwnershipCopier] User cancelled at AFM prompt.");
            return null;
        }
    }

    // Ζητάμε τις παραμέτρους του ΚΕΑ αν δεν υπάρχουν
    if (!keaParams) {
        const globalUserVat = prompt("Εισάγετε το globalUserVat του χρήστη ΚΕΑ/Πύλης:", "043409376"); // Προ-συμπληρωμένο παράδειγμα
        if (!globalUserVat) { console.log("[OwnershipCopier] User cancelled at KEA VAT prompt."); return null; }

        const e_bi_gSubExt_id = prompt("Εισάγετε το ID του ΚΕΑ/Πύλης:", "99gZmMPS9BTTkHuUFInwyw=="); // Προ-συμπληρωμένο παράδειγμα
        if (!e_bi_gSubExt_id) { console.log("[OwnershipCopier] User cancelled at KEA ID prompt."); return null; }

        const gUserType = prompt("Εισάγετε το gUserType του χρήστη ΚΕΑ/Πύλης:", "ONLINE"); // Προ-συμπληρωμένο παράδειγμα
        if (!gUserType) { console.log("[OwnershipCopier] User cancelled at KEA User Type prompt."); return null; }

        keaParams = {
            gUserType: "ONLINE", // Ή "KEA", μπορεί να γίνει και αυτό prompt αν χρειάζεται
            globalUserVat,
            e_bi_gSubExt_id,
        };
        // sessionStorage.setItem('ownershipCopier_keaParams', JSON.stringify(keaParams));
    }

    return { keaParams, producerAfm };
}


/**
 * Main function to copy ownership details from the previous year's parcels
 * to the current year's parcels based on user input.
 * @param currentApplicationId - The ID of the current year's application (e.g., 2025).
 */
export async function copyPreviousYearOwnerships(currentApplicationId: string) {
    try {
        // 1. Λήψη ή ερώτηση για ΑΦΜ και παραμέτρους ΚΕΑ
        const requiredIds = await getOrPromptForRequiredIds();
        if (!requiredIds) {
            return; // Ο χρήστης ακύρωσε τη διαδικασία
        }
        const { keaParams, producerAfm } = requiredIds;

        console.log(`[OwnershipCopier] Starting process for Current AppID: ${currentApplicationId}, Target AFM: ${producerAfm}`);
        console.log("[OwnershipCopier] Using KEA Params:", keaParams);

        // 2. Ερώτηση προς τον χρήστη για τους κωδικούς των αγροτεμαχίων
        const targetParcelCodesInput = prompt(`Αντιγραφή ιδιοκτησιών για ΑΦΜ: ${producerAfm}\n\nΕισάγετε τους κωδικούς (Α/Α) των φετινών αγροτεμαχίων, χωρισμένους με κόμμα (π.χ. 8, 9, 11):`);
        if (!targetParcelCodesInput) {
            console.log("[OwnershipCopier] User cancelled at parcel codes prompt.");
            return;
        }
        const targetParcelCodes = targetParcelCodesInput.split(',').map(code => code.trim()).filter(Boolean);
        if (targetParcelCodes.length === 0) {
            alert("Δεν δόθηκαν έγκυροι κωδικοί αγροτεμαχίων.");
            return;
        }
        console.log("[OwnershipCopier] Target parcel codes:", targetParcelCodes);

        // 3. Εύρεση ID περσινής αίτησης
        console.log("[OwnershipCopier] Fetching previous year's application ID...");
        const prevYearAppResponse = await fetchApi('MainService/getEdesByAfm?', {
            str_afm: producerAfm,
            i_etos: EAE_YEAR - 1,
            ...keaParams
        });

        const previousYearApplicationId = prevYearAppResponse?.data?.[0]?.id;
        if (!previousYearApplicationId) {
            throw new Error(`Δεν βρέθηκε αίτηση για το έτος ${EAE_YEAR - 1} για το ΑΦΜ ${producerAfm}.`);
        }
        console.log(`[OwnershipCopier] Found previous year AppID: ${previousYearApplicationId}`);

        // 4. Ανάκτηση όλων των αγροτεμαχίων (φετινών και περσινών)
        console.log("[OwnershipCopier] Fetching current and previous year parcels...");
        const [currentYearParcelsResponse, previousYearParcelsResponse] = await Promise.all([
            fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', {
                g_Ede_id: currentApplicationId,
                gParams_yearEae: EAE_YEAR,
                fromRowIndex: 0, toRowIndex: 2000, exc_Id: []
            }),
            fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', {
                g_Ede_id: previousYearApplicationId,
                gParams_yearEae: EAE_YEAR - 1,
                fromRowIndex: 0, toRowIndex: 2000, exc_Id: []
            })
        ]);

        const currentYearParcels = currentYearParcelsResponse?.data || [];
        const previousYearParcels = previousYearParcelsResponse?.data || [];
        console.log(`[OwnershipCopier] Found ${currentYearParcels.length} current year parcels and ${previousYearParcels.length} previous year parcels.`);

        const newOwnershipsForSync = [];

        // 5. Βρόχος για κάθε αγροτεμάχιο-στόχο
        for (const targetCode of targetParcelCodes) {
            console.log(`[OwnershipCopier] --- Processing target parcel code: ${targetCode} ---`);

            const currentParcel = currentYearParcels.find(p => p.kodikos.toString() === targetCode);
            const previousParcel = previousYearParcels.find(p => p.kodikos.toString() === targetCode);

            if (!currentParcel || !previousParcel) {
                console.warn(`[OwnershipCopier] Δεν βρέθηκε αντιστοιχία για τον κωδικό αγροτεμαχίου ${targetCode} μεταξύ των ετών ${EAE_YEAR - 1} και ${EAE_YEAR}. Παράλειψη.`);
                continue;
            }

            // 6. Ανάκτηση περσινών ιδιοκτησιών
            console.log(`[OwnershipCopier] Fetching ownerships for previous year parcel ID: ${previousParcel.id}`);
            const previousOwnershipsResponse = await fetchApi('Edetedeaeeagroiem/findAllByCriteriaRange_EdetedeaeeagroiGrpEam', {
                edaId_id: previousParcel.id,
                gParams_yearEae: EAE_YEAR - 1,
                fromRowIndex: 0, toRowIndex: 100, exc_Id: []
            });
            const previousOwnerships = previousOwnershipsResponse?.data || [];
            if (previousOwnerships.length === 0) {
                console.log(`[OwnershipCopier] No ownerships found for previous year parcel ${targetCode}. Skipping.`);
                continue;
            }
            console.log(`[OwnershipCopier] Found ${previousOwnerships.length} ownerships for parcel ${targetCode}.`);

            // 7. Προετοιμασία νέων ιδιοκτησιών
            for (const prevOwnership of previousOwnerships) {
                const newOwnershipEntity = {
                    id: `TEMP_ID_${Date.now()}_${Math.random()}`,
                    afm: producerAfm, // Χρήση του ΑΦΜ που δόθηκε
                    recordtype: 0,
                    kodikos: 0,
                    iemtype: prevOwnership.iemtype,
                    etlId: prevOwnership.etlId,
                    afmidiokthth: prevOwnership.afmidiokthth,
                    nameidiokthth: prevOwnership.nameidiokthth,
                    aatemparastatiko: prevOwnership.aatemparastatiko,
                    synidiopercent: prevOwnership.synidiopercent,
                    atak: prevOwnership.atak,
                    ektashAtak: prevOwnership.ektashAtak,
                    dteenoikstart: prevOwnership.dteenoikstart,
                    dteenoikend: prevOwnership.dteenoikend,
                    etos: EAE_YEAR,
                    edeId: { id: currentApplicationId },
                    edaId: { id: currentParcel.id },
                    sexId: prevOwnership.sexId,
                    symbarith: prevOwnership.symbarith,
                    dtesymb: prevOwnership.dtesymb,
                };

                newOwnershipsForSync.push({
                    status: 0,
                    entityName: "Edetedeaeeagroiem",
                    entity: newOwnershipEntity
                });
            }
        }

        if (newOwnershipsForSync.length === 0) {
            alert("Δεν βρέθηκαν ιδιοκτησίες για αντιγραφή για τους κωδικούς που δώσατε.");
            return;
        }

        // 8. Αποστολή νέων ιδιοκτησιών χρησιμοποιώντας το executeSync
        console.log(`[OwnershipCopier] Ready to create ${newOwnershipsForSync.length} new ownership entries.`);
        console.log("[OwnershipCopier] Payload to be synced:", newOwnershipsForSync);

        const confirmation = confirm(`Πρόκειται να προστεθούν ${newOwnershipsForSync.length} εγγραφές ιδιοκτησίας για το ΑΦΜ ${producerAfm}. Είστε σίγουροι;`);
        if (!confirmation) {
            console.log("[OwnershipCopier] Final submission cancelled by user.");
            return;
        }

        const syncResponse = await executeSync(newOwnershipsForSync, currentApplicationId);

        console.log("[OwnershipCopier] Sync response:", syncResponse);
        alert(`Η διαδικασία ολοκληρώθηκε! Προστέθηκαν ${newOwnershipsForSync.length} εγγραφές ιδιοκτησίας. Παρακαλώ κάντε ανανέωση στη σελίδα για να δείτε τις αλλαγές.`);

    } catch (error: any) {
        console.error("[OwnershipCopier] An error occurred during the process:", error);
        alert(`Προέκυψε σφάλμα: ${error.message}`);
    }
}