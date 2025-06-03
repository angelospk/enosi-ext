import type { ProcessedMessage } from '@/stores/messages.store'; // Εισαγωγή του τύπου αν υπάρχει ήδη
// Αν δεν υπάρχει ακόμα το store, μπορείς να ορίσεις τον τύπο προσωρινά εδώ:
// interface ProcessedMessage {
//   id: string;
//   rawText: string;
//   cleanedText: string;
//   type: 'Error' | 'Warning' | 'Info' | 'Dismissed'; // Πρόσθεσε 'Dismissed' αν το θες σαν τύπο
//   relatedItemIds: string[];
//   firstSeen: number;
//   lastSeen: number;
//   isDismissedOnce?: boolean;
//   originalIndex?: number;
// }

export interface MockExtensionSettings {
  messageSortOrder: 'timeDesc' | 'type' | 'timeAsc';
  showDesktopErrorNotifications: boolean;
  // Πρόσθεσε κι άλλες ρυθμίσεις εδώ
}

export interface MockKnowledgeItem {
  code: string;
  name: string;
  category_code: string; // π.χ. 'K', 'P', 'M', 'D'
  selection_count: number;
  last_selected_timestamp?: number; // Για το recentAndPopular
}


// 1. Mock Μηνύματα Συστήματος
export const mockSystemMessages: ProcessedMessage[] = [
  {
    id: 'err1_mock',
    rawText: "Σφάλμα: Πρέπει να εισάγετε τιμή στα πεδία [Πιστωτικό Ίδρυμα] και [ΙΒΑΝ]. (Α/Α αγροτεμαχίων: 101, 102)",
    cleanedText: "Πρέπει να εισάγετε τιμή στα πεδία [Πιστωτικό Ίδρυμα] και [ΙΒΑΝ].",
    type: 'Error',
    firstSeen: Date.now() - 300000, // 5 λεπτά πριν
    lastSeen: Date.now() - 60000,   // 1 λεπτό πριν
    originalIndex: 0,
  },
  {
    id: 'warn1_mock',
    rawText: "Προειδοποίηση: Έχετε επιλέξει ΝΑΙ σε ενεργοποίηση δικαιωμάτων και δεν έχετε αιτηθεί 0401.",
    cleanedText: "Έχετε επιλέξει ΝΑΙ σε ενεργοποίηση δικαιωμάτων και δεν έχετε αιτηθεί 0401.",
    type: 'Warning',
    firstSeen: Date.now() - 240000, // 4 λεπτά πριν
    lastSeen: Date.now() - 120000,  // 2 λεπτά πριν
    originalIndex: 1,
  },
  {
    id: 'info1_mock',
    rawText: "Ενημερωτικό μήνυμα: Η επεξεργασία της αίτησης ολοκληρώθηκε.",
    cleanedText: "Η επεξεργασία της αίτησης ολοκληρώθηκε.",
    type: 'Info',
    firstSeen: Date.now() - 180000, // 3 λεπτά πριν
    lastSeen: Date.now() - 180000,
    originalIndex: 2,
  },
  {
    id: 'err2_mock',
    rawText: "Σφάλμα: Δεν επιτρέπεται η δήλωση καλλιέργειας με χαρακτηρισμό [ΠΟΤΙΣΤΙΚΟ] σε μη αρδευόμενο αγροτεμάχιο. (Α/Α αγροτεμαχίων: 1)",
    cleanedText: "Δεν επιτρέπεται η δήλωση καλλιέργειας με χαρακτηρισμό [ΠΟΤΙΣΤΙΚΟ] σε μη αρδευόμενο αγροτεμάχιο.",
    type: 'Error',
    firstSeen: Date.now() - 10000, // 10 δευτερόλεπτα πριν (πιο πρόσφατο)
    lastSeen: Date.now(),
    originalIndex: 3,
  },
  {
    id: 'warn2_mock_related',
    rawText: "Προειδοποίηση: Ελέγξτε την καλλιέργεια. (Α/Α αγροτεμαχίων: 101, 202)",
    cleanedText: "Ελέγξτε την καλλιέργεια.",
    type: 'Warning',
    firstSeen: Date.now() - 30000,
    lastSeen: Date.now() - 15000,
    originalIndex: 4,
  },
];

// 2. Mock IDs Μόνιμα Αγνοημένων Μηνυμάτων
export const mockPermanentlyDismissedIds: string[] = ['info_old_mock_dismissed'];

// Αν θέλεις να δείχνεις το κείμενο των αγνοημένων:
export const mockPermanentlyDismissedMessagesFull: ProcessedMessage[] = [
    { id: 'info_old_mock_dismissed', rawText: "Παλιό ενημερωτικό που αγνοήθηκε μόνιμα.", cleanedText: "Παλιό ενημερωτικό που αγνοήθηκε μόνιμα.", type: 'Info' /* ή 'Dismissed' */, firstSeen:0,lastSeen:0, originalIndex: 99 },
];


// 3. Mock Ρυθμίσεις Επέκτασης
export const mockExtensionSettings: MockExtensionSettings = {
  messageSortOrder: 'timeDesc', // 'type', 'timeAsc'
  showDesktopErrorNotifications: true,
};

// 4. Mock Δεδομένα Αυτόματης Συμπλήρωσης
export const mockAllKnowledgeData: { [key: string]: MockKnowledgeItem[] } = {
  K: [ // Καλλιέργειες
    { code: '1', name: 'ΣΚΛΗΡΟΣ ΣΙΤΟΣ', category_code: 'K', selection_count: 5 },
    { code: '12', name: 'ΒΑΜΒΑΚΙ', category_code: 'K', selection_count: 10 },
    { code: '25', name: 'ΕΛΑΙΟΚΡΑΜΒΗ', category_code: 'K', selection_count: 2 },
    { code: '30', name: 'ΚΑΛΑΜΠΟΚΙ', category_code: 'K', selection_count: 7 },
  ],
  M: [ // Μέτρα/Δράσεις
    { code: 'M01.1', name: 'ΒΙΟΛΟΓΙΚΗ ΓΕΩΡΓΙΑ - ΕΝΤΑΞΗ', category_code: 'M', selection_count: 3 },
    { code: 'Δ4.2', name: 'ΠΡΟΣΤΑΣΙΑ ΕΛΑΙΩΝΑ', category_code: 'M', selection_count: 8 },
  ],
  P: [ // Παραγωγικές Επενδύσεις (ΠΑΑ) - Υποθετικό
    { code: 'P001', name: 'Αγορά Τρακτέρ', category_code: 'P', selection_count: 1 },
  ],
  D: [ // Δικαιολογητικά - Υποθετικό
    { code: 'D166', name: '166 Βεβαίωση ταυτοπροσωπίας', category_code: 'D', selection_count: 4 },
  ]
};

export const mockRecentAndPopular: MockKnowledgeItem[] = [
  { code: '12', name: 'ΒΑΜΒΑΚΙ', category_code: 'K', selection_count: 10, last_selected_timestamp: Date.now() - 50000 },
  { code: 'Δ4.2', name: 'ΠΡΟΣΤΑΣΙΑ ΕΛΑΙΩΝΑ', category_code: 'M', selection_count: 8, last_selected_timestamp: Date.now() - 100000 },
  { code: '1', name: 'ΣΚΛΗΡΟΣ ΣΙΤΟΣ', category_code: 'K', selection_count: 5, last_selected_timestamp: Date.now() - 200000 },
  { code: '30', name: 'ΚΑΛΑΜΠΟΚΙ', category_code: 'K', selection_count: 7, last_selected_timestamp: Date.now() - 10000 }, // Πιο πρόσφατο
];


// 5. Mock Δεδομένα Περσινών Στοιχείων (Πολύ απλοποιημένο)
export const mockPreviousYearData = {
  paa: [
    { code: 'P001', name: 'Αγορά Τρακτέρ (Πέρυσι)'},
  ],
  oikologika: [
    { code: 'ECOSCHEME_A', name: 'Περσινό Οικολογικό Σχήμα Α' }
  ],
  enisxyseis: [
      { code: '0401', name: 'ΒΑΣΙΚΗ ΕΙΣΟΔΗΜΑΤΙΚΗ ΣΤΗΡΙΞΗ (Πέρυσι)' }
  ]
};