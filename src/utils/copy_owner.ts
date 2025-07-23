export async function handleOwnershipCopy(appId: string, jsonInput: any) {
    console.log(`--- Έναρξη Διαχείρισης Ιδιοκτησίας ---`);

    const allAgrotemaxiaResponse = await fetchApi('Edetedeaeeagroi/findAllByCriteriaRange_EdetedeaeeagroiGrpEda', { g_Ede_id: appId, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 1000 });
    const agrotemaxiaMap = new Map(allAgrotemaxiaResponse.data.map((agro: any) => [String(agro.kodikos), agro]));
    console.log(`Βρέθηκαν ${agrotemaxiaMap.size} αγροτεμάχια στην αίτηση.`);

    const fields = jsonInput.field_list || [];
    const expiredOwnerships = [];

    console.log("Αναζήτηση για ενοικιαστήρια που λήγουν τον Ιούνιο του 2025...");
    for (const field of fields) {
        const kodikos = String(field.code);
        const properties = field.field_property_list || [];
        for (const prop of properties) {
            if (!prop.rental_end_date) continue;

            const endDate = new Date(prop.rental_end_date);
            // Αλλαγή συνθήκης για λήξη τον Ιούνιο του 2025
            if (endDate.getFullYear() < 2025 || (endDate.getFullYear() === 2025 && endDate.getMonth() < 5)) { // getMonth() είναι 0-indexed, άρα 5 = Ιούνιος
                const agro = agrotemaxiaMap.get(kodikos);
                if (agro) {
                    expiredOwnerships.push({ ...prop, agro });
                }
            }
        }
    }

    console.log(`Βρέθηκαν ${expiredOwnerships.length} ληγμένα ενοικιαστήρια που ταιριάζουν στα κριτήρια.`);
    if (expiredOwnerships.length === 0) {
        alert('Δεν βρέθηκαν ενοικιαστήρια με λήξη τον Ιούνιο του 2025.');
        return;
    }
    const owners = [...new Set(expiredOwnerships.map(o => o.tin))];
    let ownerCounters={};
    let ownerPrompt = "Βρέθηκαν ληγμένα ενοικιαστήρια για τους παρακάτω ιδιοκτήτες:\n";
    owners.forEach((owner, index) => {
        ownerPrompt += `${index + 1}. ${owner}\n`;
    });
    ownerPrompt += "\nΕπιλέξτε τον αριθμό του ιδιοκτήτη για τον οποίο θέλετε να ανανεώσετε τα ενοικιαστήρια :";

    const ownerIndexStr = prompt(ownerPrompt);
    if (ownerIndexStr === null) {
        console.log("Η διαδικασία ακυρώθηκε από τον χρήστη στο prompt επιλογής ιδιοκτήτη.");
        return;
    }

    const ownerIndex = parseInt(ownerIndexStr, 10);
    let selectedOwners: string[] = [];
    if (ownerIndex==0) {
        selectedOwners=Array.from(owners);
    }
    else{
    let selectedOwner: string | null = null;
    if (ownerIndex > 0 && ownerIndex <= owners.length) {
        selectedOwner = owners[ownerIndex - 1];
    }
    if (selectedOwner) {
    selectedOwners.push(selectedOwner);
    }
    }
    for (const selectedOwner of selectedOwners) {
    console.log(`Επιλεγμένος ιδιοκτήτης: ${selectedOwner || 'Όλοι'}`);

    const startDateStr = prompt("Εισάγετε την ημερομηνία έναρξης (DD/MM/YYYY):", "01/01/2025");
    if (!startDateStr) {
        console.log("Η διαδικασία ακυρώθηκε από τον χρήστη στο prompt ημερομηνίας έναρξης.");
        return;
    }

    const endDateStr = prompt("Εισάγετε την ημερομηνία λήξης (DD/MM/YYYY):", "31/12/2030");
    if (!endDateStr) {
        console.log("Η διαδικασία ακυρώθηκε από τον χρήστη στο prompt ημερομηνίας λήξης.");
        return;
    }
    console.log(`Επιλεγμένες ημερομηνίες: Έναρξη=${startDateStr}, Λήξη=${endDateStr}`);

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

    console.log("Προετοιμασία νέων εγγραφών ιδιοκτησίας...");
    for (const ownership of expiredOwnerships) {
        if (selectedOwner && ownership.tin !== selectedOwner) continue;
        
        ownerCounters[ownership.tin]=(ownerCounters[ownership.tin]||0)+1;
        
        const newOwnershipEntry = {
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
                kodikos: ownership.code,
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
        };

        // console.log('Logging new ownership object before push:', JSON.stringify(newOwnershipEntry, null, 2));
        newOwnerships.push(newOwnershipEntry);
    }

    console.log(`Δημιουργήθηκαν ${newOwnerships.length} νέες εγγραφές ιδιοκτησίας για αποθήκευση.`);
    if (newOwnerships.length === 0) {
        alert('Δεν δημιουργήθηκαν νέα ενοικιαστήρια για αποθήκευση. Ελέγξτε το console για πιθανά σφάλματα στη λογική φιλτραρίσματος.');
        return;
    }

    
    try {
        console.log("Κλήση executeSync για αποθήκευση των αλλαγών...");
        await executeSync(newOwnerships, appId);
        alert(`Προστέθηκαν ${newOwnerships.length} νέες ιδιοκτησίες.`);
        console.log("Η αποθήκευση ολοκληρώθηκε με επιτυχία.");
    } catch (err) {
        console.error('Σφάλμα στην αποθήκευση:', err);
        alert('Σφάλμα στην αποθήκευση. Δες το console για λεπτομέρειες.');
    }
    }
} // <-- This is the correct final closing brace for the function.
