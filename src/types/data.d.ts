// src/types/data.d.ts

// Base item structure for searchable lists
export interface SearchableListItem {
  id: string; // Unique ID from the source
  kodikos: string; // The 'code' (Κωδικός)
  description: string; // The 'description' (Περιγραφή)
  selection_count: number;
  [key: string]: any; // Allow other properties from source
}

// Δημοτικές - Τοπικές Ενότητες (Category Τ)
export interface TopikiEnotita extends SearchableListItem {
  // Example specific fields from LandKalkoinotite if needed
  leveltype?: number;
  divtype?: string;
  dhmShortname?: string;
  lkpenId?: {
    id: string;
    kodikos: string;
    description: string;
  };
}

// Φυτικό Κεφάλαιο (Category Κ) - Edetzoiko
export interface FytikoKefalaio extends SearchableListItem {
  // Example specific fields from Edetzoiko
  ezotype?: number;
  mmz?: number | null;
  activeflag?: number;
  etos?: number;
}

// Ποικιλίες (Category P) - Edetpoikilia (extracted from Edetomapoi.poiId)
export interface Poikilia extends SearchableListItem {
  // Example specific fields from Edetpoikilia
  mdflag?: number;
  adflag?: number;
  activeflag?: number;
  etos?: number;
  // It might be useful to store which FytikoKefalaio it belongs to
  efyId_id?: string; // The ID of the parent Edetfytiko
  efyKodikos?: string; // Kodikos of the parent Edetfytiko
  efyDescription?: string; // Description of the parent Edetfytiko
}


// Δικαιολογητικά (Category Δ) - Edetdikaiol
export interface Dikaiologitiko extends SearchableListItem {
  // Example specific fields from Edetdikaiol
  maxSizeInBytes?: number;
  detailsRequiredType?: number | null;
  etos?: number;
}

// Μέτρα / Προγράμματα Ανάπτυξης (Category Μ) - Edetpaa (from Tomeaka)
export interface MetraAnaptyxis extends SearchableListItem {
  // Example specific fields from Edetpaa
  leveltype?: number;
  agroitype?: number;
  paatype?: number; // 1 for PAA, 2 for Tomeaka
  etos?: number;
}

// Οικολογικά Σχήματα (Category Ο) - EcoschemeGroup or Ecoscheme
// Assuming a general list might be available or defined structure
export interface OikologikoSxima extends SearchableListItem {
    // Example specific fields
    obligationrep?: string;
    etos?: number;
}

// Συνδεδεμένες Ενισχύσεις (Category Σ) - Edetsupportschema
// Assuming a general list might be available or defined structure
export interface SyndedemeniEnisxysi extends SearchableListItem {
    leveltype?: number;
    groupkodikos?: string;
    etos?: number;
}

// Structure for allData object
export interface AllData {
  T: TopikiEnotita[]; // Δημοτικές - Τοπικές Ενότητες
  K: FytikoKefalaio[]; // Φυτικό Κεφάλαιο (Καλλιέργειες Ζώων στην πραγματικότητα από το Edetzoiko)
  P: Poikilia[];       // Ποικιλίες (related to Edetfytiko, needs careful handling of source)
  D: Dikaiologitiko[]; // Δικαιολογητικά
  M: MetraAnaptyxis[]; // Μέτρα / Προγράμματα Ανάπτυξης (ΠΑΑ/Τομεακά)
  O: OikologikoSxima[];// Οικολογικά Σχήματα (General list, if available)
  S: SyndedemeniEnisxysi[]; // Συνδεδεμένες Ενισχύσεις (General list, if available)
  // Α (ΑΦΜ - Επιχειρήσεις) is handled separately as Record<string, string>
}

// Structure for items in the recentAndPopular list
export interface RecentPopularItem extends SearchableListItem {
  category_code: keyof AllData | 'A'; // 'A' for AFM
  last_selected_timestamp: number;
  // selection_count is inherited from SearchableListItem
}

// Payloads for API responses (simplified, expand as needed)
// These are generic to give an idea, specific response types might be better

export interface ApiResponse<T> {
  count: number;
  data: T[];
}

// Specific types for data to be displayed in the persistent popup tab
// Περσινά Στοιχεία
export interface PerisinaPAA {
  // Based on Edetedeaeepaa response structure
  id: string;
  afm?: string;
  kodikos?: number; // Edetedeaeepaa.kodikos
  eaaId?: {
    id: string;
    kodikos?: string; // Edetpaa.kodikos
    description?: string; // Edetpaa.description
    paaCode?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface PerisinoOikologikoSxima {
    // Define based on Edetedeaeeeco response structure
    id: string;
    afm?: string;
    kodikos?: number; // This is the Edetedeaeeeco.kodikos, not the EcoschemeGroup.kodikos
    esgrId?: { // This is the EcoschemeGroup
        id: string;
        kodikos: string; // The actual code like "Β"
        description: string;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface PerisiniEnisxysi {
    // Define based on Edetedeaeerequest response structure
    id: string;
    afm?: string;
    kodikos?: number; // This is the Edetedeaeerequest.kodikos
    eschId?: { // This is the Edetsupportschema
        id: string;
        kodikos: string; // The actual code like "0401"
        description: string;
        [key: string]: any;
    };
    [key: string]: any;
}

// Συγκεντρωτικά Στοιχεία
export interface SygkFytikoKefalaio {
    viewKey: string;
    recordtype?: number;
    efyKodikos?: string;
    efyDesc?: string;
    dikaiomatype?: number;
    counter?: number;
    totalOld?: number;
    total?: number;
    dikaiomataflag?: number;
    ektaria?: number;
    epilektashSit?: number;
    etos?: number;
    [key: string]: any;
}

export interface ApaitoumenesPosotitesSporou {
    viewKey: string;
    edeId?: number;
    afm?: string;
    eschId?: number;
    eschKodikos?: string;
    eschDescription?: string;
    efyId?: number;
    efyKodikos?: string;
    efyDescription?: string;
    poiId?: number;
    poiKodikos?: string;
    poiDescription?: string;
    minSporosqtyAnaHa?: number;
    checkSporosqtyFlag?: number;
    sporosqty?: number | null;
    etiketes?: number | null;
    epilektash?: number;
    sporosqtyRequired?: number;
    etos?: number;
    [key: string]: any;
}
