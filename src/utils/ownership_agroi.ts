// --- Βοηθητικές Τύποι ---
type AadeParcel = {
  atakStr: string;
  address: string;
  landPossessedHa?: number | { parsedValue?: number; source?: string };
  landPossessedHectares?: number | { parsedValue?: number; source?: string };
  [key: string]: any;
};

type UsedParcel = {
  atak: string;
  [key: string]: any;
};

type UnusedParcel = {
  "ΑΤΑΚ": string;
  "Τοποθεσία": string;
  "Έκταση (Ha)": number;
};

// Συνάρτηση για την ανάκτηση ΟΛΩΝ των διαθέσιμων αγροτεμαχίων από την ΑΑΔΕ
const fetchAadeParcels = async (afm: string): Promise<AadeParcel[]> => {
  const apiUrl = 'https://eae2024.opekepe.gov.gr/eae2024/rest/AadeWsStoixeia/findAllByCriteriaRange_Edetedeaeeagroi_AadeLovBtn?';
  const payload = {
    "g_Ede_afm": afm,
    "gParams_yearEae": 2025,
    "fromRowIndex": 0,
    "toRowIndex": 9999, // Μεγάλος αριθμός για να τα φέρει όλα
    "exc_Id": [],
    "sortField": "address",
    "sortOrder": true
  };
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Σφάλμα στην κλήση ΑΑΔΕ: ${response.statusText}`);
  const result = await response.json();
  return result.data || [];
};

// Συνάρτηση για την ανάκτηση των ΗΔΗ ΧΡΗΣΙΜΟΠΟΙΗΜΕΝΩΝ ΑΤΑΚ στην αίτηση
const fetchUsedParcels = async (edeId: string): Promise<UsedParcel[]> => {
  const apiUrl = 'https://eae2024.opekepe.gov.gr/eae2024/rest/EdevSygkStoixeiaAtak/findAllByCriteriaRange_EdevSygkStoixeiaAtakGrpEdevStAtak';
  const payload = {
    "g_Ede_id": edeId,
    "gParams_yearEae": 2025,
    "fromRowIndex": 0,
    "toRowIndex": 9999, // Μεγάλος αριθμός για να τα φέρει όλα
    "exc_Id": []
  };
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Σφάλμα στην κλήση Αίτησης: ${response.statusText}`);
  const result = await response.json();
  return result.data || [];
};

// Συνάρτηση για την εξαγωγή της έκτασης (χειρίζεται διαφορετικές μορφές)
const getAreaHa = (item: AadeParcel): number => {
  const areaField = item.landPossessedHa || item.landPossessedHectares;
  if (typeof areaField === 'object' && areaField !== null) {
    return areaField.parsedValue || parseFloat(areaField.source ?? '') || 0;
  }
  return typeof areaField === 'number' ? areaField : 0;
};

// --- Κύρια Λογική του Script ---
// Εξάγουμε ως async function που δέχεται afm και edeId ως παραμέτρους
export async function findUnusedParcels(afm: string, edeId: string): Promise<void> {
    // 1. Κλήση του fetchOwnerAtakInfoFromAade API πριν από όλα τα άλλα
    try {
      const fetchOwnerAtakInfoUrl = 'https://eae2024.opekepe.gov.gr/eae2024/rest/MainService/fetchOwnerAtakInfoFromAade?';
      const fetchOwnerAtakInfoPayload = {
        edeId: edeId,
        forceUpdate: true,
        etos: 2025
      };
      const fetchOwnerAtakInfoResponse = await fetch(fetchOwnerAtakInfoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify(fetchOwnerAtakInfoPayload)
      });
      if (!fetchOwnerAtakInfoResponse.ok) {
        throw new Error(`Σφάλμα στην κλήση fetchOwnerAtakInfoFromAade: ${fetchOwnerAtakInfoResponse.statusText}`);
      }
      const fetchOwnerAtakInfoResult = await fetchOwnerAtakInfoResponse.json();
      console.log("Αποτέλεσμα fetchOwnerAtakInfoFromAade:", fetchOwnerAtakInfoResult);
    } catch (err) {
      console.warn("Σφάλμα κατά την κλήση fetchOwnerAtakInfoFromAade:", err);
      // Δεν σταματάμε τη διαδικασία, συνεχίζουμε
    }
    try {
    if (!afm) {
      console.log("Η διαδικασία ακυρώθηκε (λείπει το ΑΦΜ).");
      return;
    }
    if (!edeId) {
      console.log("Η διαδικασία ακυρώθηκε (λείπει το ID αίτησης).");
      return;
    }

    console.log(`Αναζήτηση για ΑΦΜ: ${afm} και ID Αίτησης: ${edeId}...`);
    console.log("Παρακαλώ περιμένετε...");

    // 2. Εκτέλεση των δύο κλήσεων ταυτόχρονα για ταχύτητα
    const [allAadeParcels, usedApplicationParcels] = await Promise.all([
      fetchAadeParcels(afm),
      fetchUsedParcels(edeId)
    ]);
    console.log(allAadeParcels);
    console.log(usedApplicationParcels);
    console.log(`Βρέθηκαν ${allAadeParcels.length} διαθέσιμα αγροτεμάχια από ΑΑΔΕ.`);
    console.log(`Βρέθηκαν ${usedApplicationParcels.length} χρησιμοποιημένα αγροτεμάχια στην αίτηση.`);

    // 3. Δημιουργία ενός Set με τα ΑΤΑΚ που έχουν ήδη χρησιμοποιηθεί για γρήγορη αναζήτηση
    const usedAtakSet = new Set<string>(usedApplicationParcels.map((p: UsedParcel) => p.atak));

    // 4. Φιλτράρισμα για να βρούμε τα αχρησιμοποίητα αγροτεμάχια
    const unusedParcels: UnusedParcel[] = allAadeParcels
      .filter((parcel: AadeParcel) => !usedAtakSet.has(parcel.atakStr))
      .map((item: AadeParcel) => ({
        "ΑΤΑΚ": item.atakStr,
        "Τοποθεσία": item.address.trim(),
        "Έκταση (Ha)": getAreaHa(item)
      }))
      .sort((a, b) => a.ΑΤΑΚ.localeCompare(b.ΑΤΑΚ, undefined, { numeric: true }));

    // 5. Έλεγχος και εμφάνιση αποτελεσμάτων
    if (unusedParcels.length === 0) {
      console.log("\n✅ Όλα τα διαθέσιμα αγροτεμάχια από την ΑΑΔΕ έχουν ήδη αντιστοιχιστεί στην αίτηση.");
      return;
    }

    console.log(`\n✅ Βρέθηκαν ${unusedParcels.length} αχρησιμοποίητα αγροτεμάχια.`);
    console.log("--- ΑΠΟΤΕΛΕΣΜΑΤΑ ---");

    // Έξοδος σε μορφή πίνακα (για επισκόπηση στην κονσόλα)
    console.log("\n📋 Επισκόπηση σε μορφή πίνακα:");
    console.table(unusedParcels);

    // Έξοδος σε μορφή κειμένου για αντιγραφή σε Excel/Sheets
    const header = "ΑΤΑΚ\tΤοποθεσία\tΈκταση (Ha)";
    const tsvRows = unusedParcels.map((p: UnusedParcel) => {
      const formattedArea = p["Έκταση (Ha)"].toFixed(4).replace('.', ',');
      return `${p.ΑΤΑΚ}\t${p.Τοποθεσία}\t${formattedArea}`;
    });
    const tsvOutput = [header, ...tsvRows].join('\n');

    console.log("\n\n\n📋📋📋 Για επικόλληση σε Excel / Google Sheets 📋📋📋");
    console.log("--- Αντιγράψτε ολόκληρο το παρακάτω κείμενο (μαζί με την επικεφαλίδα) ---");
    console.log(tsvOutput);
    console.log("--------------------------------------------------------------------");

  } catch (error: any) {
    console.error("❌ ΠΡΟΕΚΥΨΕ ΣΦΑΛΜΑ:", error?.message);
    console.error("Βεβαιωθείτε ότι εκτελείτε το script μέσα από τη σελίδα του ΟΠΕΚΕΠΕ, έχετε ενεργή σύνδεση και τα ΑΦΜ/ID είναι σωστά.");
  }
}