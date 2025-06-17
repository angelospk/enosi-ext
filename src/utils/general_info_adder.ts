import { fetchApi, EAE_YEAR } from './api_helpers'; // Υποθέτουμε ότι οι helpers είναι εδώ

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
        KARTELA_MALAKOY: 'UY4OQAw5jGRyp/pz1LZVZA==',
        TIMOLOGIO_MALAKOY: 'Wi19dzZG2iOt8IXxFdUJlg==',
        KARTELA_VAMVAKIOY: 'uMnQ+pmu2sxPxxVN0WVlNQ==',
        TIMOLOGIO_VAMVAKIOY: 'DRvwyxmdjYpP6pztWL2S8Q==',
        LIPASMATA: 'LeTo1TqFJQmrGUNIUb4iPA==', // 215
        AKROFYSIA: 'bg7ijd2umwp6fMGcfg3ziA==',
    },
    // IDs για Σύμβαση Ηλίανθου (Edetedeaeemetcom)
    HLIANTHOS_IDS: {
        EMC_ID: 'KTSgRe2sSLggaN9qu8u/Pg==',
        EFEC_ID: 'WFUwa5UO57dxpXhnvqIKRA==',
    }
};

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
        console.log(`Επιλέξιμος για Αναδιανεμητική: ${isEpileximosAnadian}`);

        const metraResp = await fetchApi('Edetedeaeepaa/findAllByCriteriaRange_EdetedeaeehdGrpEdaa_count', { edeId_id: appId, gParams_yearEae: EAE_YEAR, exc_Id: [] });
        let metraKodikosCounter = metraResp.count;

        const requestsResp = await fetchApi('Edetedeaeerequest/findAllByCriteriaRange_EdetedeaeehdGrpEdrq_count', { edeId_id: appId, gParams_yearEae: EAE_YEAR, exc_Id: [] });
        let requestsKodikosCounter = requestsResp.count;

        const gdprIdsResp = await fetchApi('Edetedeaeegdpr/findAllByCriteriaRange_EdetedeaeehdGrpEdgdpr', { edeId_id: appId, gParams_yearEae: EAE_YEAR, fromRowIndex: 0, toRowIndex: 2000, exc_Id: [] });
        const gdprEntities = gdprIdsResp.data || [];

        const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: appId });
        let currentEdehd = edehdResponse.data[0];
        const userSexId = currentEdehd.sexId.id;

        // --- ΒΗΜΑ 1: Προετοιμασία και Εκτέλεση του Πρώτου Μεγάλου Batch (Γενικά Στοιχεία) ---
        console.log("Βήμα 1: Προετοιμασία του πρώτου batch (Γενικά Στοιχεία, Μέτρα, Ενισχύσεις, Eco, GDPR)...");
        const mainChanges: any[] = [];
        let tempIdCounter = 0;
        const getTempId = () => `TEMP_ID_${Date.now()}_${tempIdCounter++}`;

        // 1.1: Αλλαγές στην Κύρια Αίτηση (Edetedeaeehd)
        currentEdehd.businessGroupFlag = 0; // Όχι σε όμιλο επιχειρήσεων
        currentEdehd.entolheispflag = 1;    // Ασφαλιστική: ΝΑΙ
        currentEdehd.entolhxreflag = 0;     // Ασφαλιστική: ΟΧΙ
        currentEdehd.pendingelgaflag = 1;   // Ασφαλιστική: ΝΑΙ

        // 1.2: Προσθήκη Μέτρων Εξισωτικής
        if (jsonInput.exisotiki) {
            console.log("  -> Προσθήκη μέτρων εξισωτικής (13.1, 13.2, 13.3)...");
            // Χρησιμοποιούμε τα eaaId από τις σταθερές
            Object.values(CONSTANTS.EXISOTIKI_EAA_IDS).forEach(eaaId => {
                metraKodikosCounter++;
                mainChanges.push({
                    status: 0,
                    when: Date.now(),
                    entityName: 'Edetedeaeepaa',
                    entity: {
                        id: getTempId(),
                        afm: currentEdehd.afm,
                        kodikos: metraKodikosCounter,
                        etos: EAE_YEAR,
                        eaaLt2: 2, // Σημαντικό πεδίο από το παράδειγμα
                        edeId: { id: appId },
                        eaaId: { id: eaaId }, // Η σωστή ιδιότητα είναι eaaId
                        sexId: { id: userSexId }
                        // Τα υπόλοιπα πεδία (π.χ. remarks, rowVersion) είναι null by default
                    }
                });
            });
        }

        // 1.3: Προσθήκη Άμεσων Ενισχύσεων
        if (isEpileximosAnadian) {
            console.log("  -> Προσθήκη Αναδιανεμητικής Ενίσχυσης...");
            requestsKodikosCounter++;
            mainChanges.push({
                status: 0, when: Date.now(), entityName: 'Edetedeaeerequest',
                entity: {
                    id: getTempId(), afm: currentEdehd.afm, kodikos: requestsKodikosCounter, etos: EAE_YEAR, eschLt2: 2,
                    edeId: { id: appId }, eschId: { id: CONSTANTS.ESCH_IDS.ANADIANEMITIKI }, sexId: { id: userSexId }
                }
            });
        }
        
        const syndedemenes = [
            { flag: 'skliros_sitos', eschId: CONSTANTS.ESCH_IDS.SKLIROS_SITOS },
            { flag: 'malakos_sitos', eschId: CONSTANTS.ESCH_IDS.MALAKOS_SITOS },
            { flag: 'vamvaki', eschId: CONSTANTS.ESCH_IDS.VAMVAKI }
        ];

        let hasSyndedemeni = false;
        syndedemenes.forEach(synd => {
            if (jsonInput[synd.flag]) {
                hasSyndedemeni = true;
                console.log(`  -> Προσθήκη συνδεδεμένης για ${synd.flag}...`);
                const timologio = jsonInput.timologia?.find((t: any) => t.kalliergeia === synd.flag);
                if (!timologio) {
                    console.warn(`Δεν βρέθηκε τιμολόγιο για ${synd.flag} στο JSON εισόδου.`);
                    return;
                }
                
                requestsKodikosCounter++;
                const requestTempId = getTempId();
                mainChanges.push({
                    status: 0, when: Date.now(), entityName: 'Edetedeaeerequest',
                    entity: {
                        id: requestTempId, afm: currentEdehd.afm, kodikos: requestsKodikosCounter, etos: EAE_YEAR, eschLt2: 2,
                        edeId: { id: appId }, eschId: { id: synd.eschId }, sexId: { id: userSexId }
                    }
                });
                mainChanges.push({
                    status: 0, when: Date.now(), entityName: 'Edetedeaeerequestsporo',
                    entity: {
                        id: getTempId(), afm: currentEdehd.afm, kodikos: 1, etos: EAE_YEAR,
                        sporosqty: timologio.posotita, etiketes: timologio.etiketes,
                        edeId: { id: appId }, edrqId: { id: requestTempId }, eschId: { id: synd.eschId },
                        sexId: { id: userSexId }, efyId: { id: timologio.poikilia.efyId }, poiId: { id: timologio.poikilia.poiId }
                    }
                });
                mainChanges.push({
                    status: 0, when: Date.now(), entityName: 'Edetedeaeerequestinvoice',
                    entity: {
                        id: getTempId(), afm: currentEdehd.afm, kodikos: 1, etos: EAE_YEAR,
                        timologioafm: timologio.afm, timologioname: timologio.epwnymia, timologiodte: timologio.hmerominia,
                        edeId: { id: appId }, edrqId: { id: requestTempId }, sexId: { id: userSexId }
                    }
                });
            }
        });

        if (!hasSyndedemeni) {
             console.log("  -> Καμία συνδεδεμένη δεν επιλέχθηκε. Προσθήκη δοκιμαστικού τιμολογίου/καλλιέργειας δεν υλοποιείται προς το παρόν.");
        }

        // 1.4: Προσθήκη Οικολογικών Σχημάτων
        if (jsonInput.lipasmata) {
            console.log("  -> Προσθήκη Eco-Scheme για Λιπάσματα...");
            const ecoTempId = getTempId();
            mainChanges.push({
                status: 0, when: Date.now(), entityName: 'Edetedeaeeeco',
                entity: {
                    id: ecoTempId, afm: currentEdehd.afm, kodikos: 1, etos: EAE_YEAR,
                    edeId: { id: appId }, esgrId: { id: CONSTANTS.ECO_SCHEME_IDS.LIPASMATA }, sexId: { id: userSexId }
                }
            });
            for (let i = 1; i <= 2; i++) {
                mainChanges.push({
                    status: 0, when: Date.now(), entityName: 'Edetedeaeeecoinvoice',
                    entity: {
                        id: getTempId(), afm: currentEdehd.afm, kodikos: i, etos: EAE_YEAR,
                        timologioafm: "096049221", timologioname: "ΕΝΩΣΗ ΑΓΡΟΤΙΚΩΝ ΣΥΝΕΤΑΙΡΙΣΜΩΝ ΟΡΕΣΤΙΑΔΑΣ", timologiodte: new Date().toISOString(),
                        edeId: { id: appId }, edegId: { id: ecoTempId }, sexId: { id: userSexId }
                    }
                });
            }
        }
        if (jsonInput.viologiko) {
            console.log("  -> Προσθήκη Eco-Scheme για Βιολογικά...");
            mainChanges.push({
                status: 0, when: Date.now(), entityName: 'Edetedeaeeeco',
                entity: {
                    id: getTempId(), afm: currentEdehd.afm, kodikos: 2, etos: EAE_YEAR,
                    edeId: { id: appId }, esgrId: { id: CONSTANTS.ECO_SCHEME_IDS.VIOLOGIKO }, sexId: { id: userSexId }
                }
            });
        }

        // 1.5: Ενημέρωση GDPR
        console.log("  -> Ενημέρωση όλων των GDPR σε 'ΝΑΙ'...");
        gdprEntities.forEach(gdpr => {
            mainChanges.push({
                status: 1, when: Date.now(), entityName: 'Edetedeaeegdpr',
                entity: { ...gdpr, sygkatatheshflag: 1 }
            });
        });

        // 1.6: Προσθήκη της ενημερωμένης αίτησης στο τέλος του batch
        mainChanges.push({
            status: 1, when: 0, entityName: 'Edetedeaeehd',
            entity: currentEdehd
        });

        // 1.7: Εκτέλεση του πρώτου batch
        console.log(`Αποστολή ${mainChanges.length} αλλαγών στο πρώτο batch...`);
        const mainSyncResponse = await fetchApi('MainService/synchronizeChangesWithDb_Edetedeaeehd', mainChanges);
        console.log("Απάντηση από το πρώτο batch:", mainSyncResponse);
        if (mainSyncResponse.warningMessages || mainSyncResponse.errorMessages) {
             console.warn("Προειδοποιήσεις/Σφάλματα από το πρώτο batch:", mainSyncResponse);
        }

        // --- ΒΗΜΑ 2: Προσθήκη Σύμβασης Ηλίανθου (αν χρειάζεται) ---
        if (jsonInput.hlianthos_sumbasi) {
            console.log("Βήμα 2: Προετοιμασία και εκτέλεση batch για Σύμβαση Ηλίανθου...");
            const contractChanges: any[] = [];
            
            const latestEdehdResp = await fetchApi('Edetedeaeehd/findById', { id: appId });
            currentEdehd = latestEdehdResp.data[0];

            contractChanges.push({
                status: 0, when: Date.now(), entityName: 'Edetedeaeemetcom',
                entity: {
                    id: getTempId(), afm: currentEdehd.afm, kodikos: 1, etos: EAE_YEAR,
                    arsymbashmet: "1", dtesymbashmet: new Date().toISOString(), contractektash: 1,
                    edeId: { id: appId }, emcId: { id: CONSTANTS.HLIANTHOS_IDS.EMC_ID }, efecId: { id: CONSTANTS.HLIANTHOS_IDS.EFEC_ID }
                }
            });
            contractChanges.push({
                status: 1, when: 0, entityName: 'Edetedeaeehd',
                entity: currentEdehd
            });

            const contractSyncResponse = await fetchApi('MainService/synchronizeChangesWithDb_Edetedeaeemetcom', { params: { data: contractChanges } });
            console.log("Απάντηση από το batch σύμβασης:", contractSyncResponse);
        }

        // --- ΒΗΜΑ 3: Προσθήκη Δικαιολογητικών (αν χρειάζεται) ---
        console.log("Βήμα 3: Προετοιμασία και εκτέλεση batch για Δικαιολογητικά...");
        const dikaiologitikaChanges: any[] = [];
        const dikaiologitikaResp = await fetchApi('Edetedeaeedikaiol/findAllByCriteriaRange_EdetedeaeedikaiolGrpEdl_count', { g_Ede_id: appId, gParams_yearEae: EAE_YEAR, exc_Id: [] });
        let dikKodikosCounter = dikaiologitikaResp.count;

        const addDikaiologitiko = (edkId: string) => {
            dikKodikosCounter++;
            dikaiologitikaChanges.push({
                status: 0, when: Date.now(), entityName: 'Edetedeaeedikaiol',
                entity: {
                    id: getTempId(), afm: currentEdehd.afm, kodikos: dikKodikosCounter, etos: EAE_YEAR, fileYear: EAE_YEAR,
                    edeId: { id: appId }, edkId: { id: edkId }
                }
            });
        };
        
        addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TAYTOPROSOPIA);

        if (jsonInput.skliros_sitos) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.KARTELA_SKLIROY); addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TIMOLOGIO_SKLIROY); }
        if (jsonInput.malakos_sitos) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.KARTELA_MALAKOY); addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TIMOLOGIO_MALAKOY); }
        if (jsonInput.vamvaki) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.KARTELA_VAMVAKIOY); addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.TIMOLOGIO_VAMVAKIOY); }
        if (jsonInput.lipasmata) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.LIPASMATA); }
        if (jsonInput.akrofysia) { addDikaiologitiko(CONSTANTS.DIKAIOLOGITIKA_IDS.AKROFYSIA); }

        if (dikaiologitikaChanges.length > 0) {
            const finalEdehdResp = await fetchApi('Edetedeaeehd/findById', { id: appId });
            currentEdehd = finalEdehdResp.data[0];
            
            dikaiologitikaChanges.push({
                status: 1, when: 0, entityName: 'Edetedeaeehd',
                entity: currentEdehd
            });

            console.log(`Αποστολή ${dikaiologitikaChanges.length} αλλαγών στο batch δικαιολογητικών...`);
            const dikSyncResponse = await fetchApi('MainService/synchronizeChangesWithDb_Edetedeaeedikaiol', { params: { data: dikaiologitikaChanges } });
            console.log("Απάντηση από το batch δικαιολογητικών:", dikSyncResponse);
        } else {
            console.log("Δεν υπάρχουν νέα δικαιολογητικά για προσθήκη.");
        }

        alert("Η μαζική ενημέρωση ολοκληρώθηκε με επιτυχία!");

    } catch (error) {
        console.error("--- ΚΡΙΣΙΜΟ ΣΦΑΛΜΑ ΚΑΤΑ ΤΗ ΜΑΖΙΚΗ ΕΝΗΜΕΡΩΣΗ ---", error);
        alert(`Προέκυψε σφάλμα: ${(error as Error).message}`);
    } finally {
        document.body.style.cursor = 'default';
        console.log("--- Τέλος Μαζικής Ενημέρωσης ---");
    }
}