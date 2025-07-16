import { fetchApi, EAE_YEAR } from './api';
// Assuming executeSync is also exported from api or another utility file
// If not, you'll need to define it. For this example, let's assume it's in './api'.
import { executeSync } from './api'; 

export async function handleOwnershipCopy(appId: string, jsonInput: any) {
    console.log(`--- Έναρξη Διαχείρισης Ιδιοκτησίας ---`);

    const allAgrotemaxiaResponse = await fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', { g_Ede_id: appId, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 1000 });
    const agrotemaxiaMap = new Map(allAgrotemaxiaResponse.data.map((agro: any) => [String(agro.kodikos), agro]));

    const fields = jsonInput.field_list || [];
    const expiredOwnerships = [];

    for (const field of fields) {
        const kodikos = String(field.code);
        const properties = field.field_property_list || [];
        for (const prop of properties) {
            if (!prop.rental_end_date) continue;

            const endDate = new Date(prop.rental_end_date);
            if (endDate.getFullYear() === 2024) {
                const agro = agrotemaxiaMap.get(kodikos);
                if (agro) {
                    expiredOwnerships.push({ ...prop, agro });
                }
            }
        }
    }

    if (expiredOwnerships.length === 0) {
        alert('Δεν βρέθηκαν ενοικιαστήρια με λήξη το 2024.');
        return;
    }

    const owners = [...new Set(expiredOwnerships.map(o => o.tin))];
    let ownerCounters={};
    let ownerPrompt = "Βρέθηκαν ληγμένα ενοικιαστήρια για τους παρακάτω ιδιοκτήτες:\n";
    owners.forEach((owner, index) => {
        ownerPrompt += `${index + 1}. ${owner}\n`;
    });
    ownerPrompt += "\nΕπιλέξτε τον αριθμό του ιδιοκτήτη για τον οποίο θέλετε να ανανεώσετε τα ενοικιαστήρια (ή 0 για όλους):";

    const ownerIndexStr = prompt(ownerPrompt);
    if (ownerIndexStr === null) return;

    const ownerIndex = parseInt(ownerIndexStr, 10);
    let selectedOwner: string | null = null;
    if (ownerIndex > 0 && ownerIndex <= owners.length) {
        selectedOwner = owners[ownerIndex - 1];
    }

    const startDateStr = prompt("Εισάγετε την ημερομηνία έναρξης (DD/MM/YYYY):", "01/01/2025");
    if (!startDateStr) return;

    const endDateStr = prompt("Εισάγετε την ημερομηνία λήξης (DD/MM/YYYY):", "31/12/2030");
    if (!endDateStr) return;

    const [startDay, startMonth, startYear] = startDateStr.split('/').map(Number);
    const [endDay, endMonth, endYear] = endDateStr.split('/').map(Number);
    const dteenoikstart = new Date(startYear, startMonth - 1, startDay).toISOString();
    const dteenoikend = new Date(endYear, endMonth - 1, endDay).toISOString();

    const newOwnerships = [];
    const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: appId });
    const applicantAfm = edehdResponse.data[0].afm;

    console.log("Ανάκτηση τύπου παραστατικού για ιδιωτικό συμφωνητικό...");
    const titleResponse = await fetchApi('Edetitle/findAllByCriteriaRange_forLov', { gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 100 });
    const rentalTitle = titleResponse.data.find((title: any) => title.kodikos === "2020");

    if (!rentalTitle) {
        alert('Δεν βρέθηκε ο τύπος παραστατικού για ιδιωτικό συμφωνητικό (κωδικός 2020). Η διαδικασία ακυρώνεται.');
        return;
    }
    const rentalTitleId = rentalTitle.id;
    console.log(`Βρέθηκε ID για ιδιωτικό συμφωνητικό: ${rentalTitleId}`);


    for (const ownership of expiredOwnerships) {
        if (selectedOwner && ownership.full_name !== selectedOwner) continue;
        ownerCounters[ownership.tin]=(ownerCounters[ownership.tin]||0)+1;
        newOwnerships.push({
            status: 0,
            when: Date.now(),
            entityName: "Edetedeaeeagroiem",
            entity: {
                id: `TEMP_ID_${Math.random().toString(36).substr(2, 9)}`,
                afm: applicantAfm,
                recordtype: 0,
                usrinsert: null,
                dteinsert: null,
                usrupdate: null,
                dteupdate: null,
                kodikos: ownership.agro.kodikos,
                remarks: null,
                afmidiokthth: ownership.tin,
                nameidiokthth: ownership.full_name,
                sexId: null,
                ebbId: null,
                aatemparastatiko: ownerCounters[ownership.tin]||1,
                synidiopercent: ownership.ownership_percent,
                iemtype: 1, // Ενοικιαζόμενο
                rowVersion: null,
                atak: ownership.atak,
                kaek: null,
                dteenoikstart,
                dteenoikend,
                symbarith: null,
                dtesymb: null,
                atakvalidflag: null,
                eEnoikArith: null,
                eEnoikDte: null,
                ektashAtak: ownership.area_participation_atak || 1,
                etos: EAE_YEAR,
                edeId: { id: appId },
                edaId: { id: ownership.agro.id },
                etlId: { id: rentalTitleId },
                eatexId: null,
                edlId: null
            }
        });
    }

    if (newOwnerships.length === 0) {
        alert('Δεν δημιουργήθηκαν νέα ενοικιαστήρια.');
        return;
    }
    
    // The try/catch block now correctly resides inside the async function
    try {
        // Note: The original code used 'executeSync' but the import was for 'synchronizeChanges'
        // I am assuming 'executeSync' is the correct function name.
        await executeSync(newOwnerships, appId);
        alert(`Προστέθηκαν ${newOwnerships.length} νέες ιδιοκτησίες.`);
    } catch (err) {
        console.error('Σφάλμα στην αποθήκευση:', err);
        alert('Σφάλμα στην αποθήκευση. Δες το console.');
    }
} // <-- This is the correct final closing brace for the function.