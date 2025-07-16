// content-scripts/shortcuts.ts

import { useKeaStore } from '../stores/kea.store';
import { messageStore } from './state';
import { toggleUIVisibility, toggleShortcutsModal, togglePersistentPopup } from './ui';
import { copyAgrotemaxioData, copyBioflagToTargets, getAfmForApplication } from './agro-actions';
import { fetchApi, synchronizeChanges, executeSync, EAE_YEAR, toApiDateFormat } from '../utils/api';
import { handleMassUpdateFromJson } from '../utils/general_info_adder';
import { handleOwnershipCopy } from '../utils/copy_owner';
import { findUnusedParcels } from '../utils/ownership_agroi';
import { handleOwnershipTry } from '../utils/copy_owner_old'

async function navigateToTab(tabText: string, requiredBaseUrlPath: string): Promise<boolean> {
  const currentPath = window.location.hash;
  if (!currentPath.startsWith(requiredBaseUrlPath)) {
    const mainPageUrl = `https://eae2024.opekepe.gov.gr/eae2024/${requiredBaseUrlPath}`;
    window.location.href = mainPageUrl;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for navigation
  }

  // await new Promise(resolve => setTimeout(resolve, 500)); // Wait for tabs to render

  const tabElements = document.querySelectorAll<HTMLElement>('div.q-tab[role="tab"]');
  for (const tab of Array.from(tabElements)) {
    const label = tab.querySelector<HTMLDivElement>('.q-tab__label');
    if (label && label.textContent?.trim() === tabText) {
      if (!tab.classList.contains('q-tab--active')) {
        tab.click();
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      return true;
    }
  }
  console.warn(`CS: Tab "${tabText}" not found.`);
  return false;
}



async function handleShortcut(event: KeyboardEvent) { 
  if (event.ctrlKey && event.key === '/') {
      event.preventDefault();
    event.stopPropagation();   
    toggleShortcutsModal();
      return;
    }
  if (!event.ctrlKey) return;

  let shortcutPerformed = true;
  const key = event.key.toLowerCase();
  const appId = messageStore.currentApplicationId;

  switch (key) {

    case '2':
  event.preventDefault();
  event.stopPropagation(); 
      await navigateToTab('Συγκατάθεση GDPR', `#/Edetedeaeehd?id=${appId}`);
      // else alert("ID Αίτησης δεν έχει οριστεί.");
      break;
    case '3':
      event.preventDefault();
  event.stopPropagation(); 
      window.location.href = 'https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeemetcom';
      break;
    case '4':
      event.preventDefault();
  event.stopPropagation(); 
      window.location.href = 'https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeeagroi';
      break;
    case '5':{
      event.preventDefault();
  event.stopPropagation(); 
      // await navigateToTab('Ιδιοκτησία', '#/Edetedeaeeagroi');
      // Find the dropdown button.
      const dropdownButton = document.querySelector("button.q-btn-dropdown");
      if (dropdownButton) {
        console.log("Extension: Clicking dropdown button to reveal submenu.", dropdownButton);
        (dropdownButton as HTMLButtonElement).click();
        // Wait a bit for the submenu to render
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        console.warn("Extension: Dropdown button not found.");
        alert("Extension: Δεν βρέθηκε το κουμπί dropdown.");
        break;
      }
      //loop that tries 5 times to find the 'Γενικά Στοιχεία' button with 50ms delay between each try
      for (let i = 0; i < 5; i++) {
        const buttons = document.querySelectorAll("button.btn_primary");
        let targetButton: HTMLButtonElement | null = null;
        for (const button of Array.from(buttons)) {
          const span = button.querySelector("span.block");
          if (span && span.textContent?.trim() === 'Έλεγχος Λαθών Αίτησης') { 
            targetButton = button as HTMLButtonElement;
            break;
          }
        }
        if (targetButton) {
          console.log(`Extension: Clicking 'Έλεγχος Λαθών Αίτησης' button:`, targetButton);
          targetButton.click();
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Now, find and click the 'Γενικά Στοιχεία' button
      const buttons = document.querySelectorAll("button.btn_primary");
      let targetButton: HTMLButtonElement | null = null;
      for (const button of Array.from(buttons)) {
        const span = button.querySelector("span.block");
        if (span && span.textContent?.trim() === 'Έλεγχος Λαθών Αίτησης') {
          targetButton = button as HTMLButtonElement;
          break;
        }
      }
      break
    }
    case '6':
      event.preventDefault();
  event.stopPropagation(); 
      window.location.href = 'https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeedikaiol';
      break;
    // case '7':
    //   await navigateToTab('Φυτικό Κεφάλαιο', '#/Edetedeaeeagroi');
    //   break;
    // case '9':

    case '0':
      toggleUIVisibility();
      break;
    case 'ι':
    case 'i':
      copyAgrotemaxioData(appId || '');
      break;
    case 'b':
    case 'β':
      copyBioflagToTargets(appId || '');
      break;
    case 'σ':
    case 's': {
      const buttons = document.querySelectorAll("button.btn_header_primary");
      let saveButton: HTMLButtonElement | null = null;
      for (const button of Array.from(buttons)) {
          const icon = button.querySelector("i.material-icons");
          if (icon && icon.textContent?.trim() === 'save') {
              saveButton = button as HTMLButtonElement;
              break;
          }
      }

      if (saveButton) {
          console.log(`Extension: Clicking Save button:`, saveButton);
          saveButton.click();
      } else {
         console.warn("Extension: Save button not found.");
         alert("Extension: Δεν βρέθηκε το κουμπί αποθήκευσης.");
      }
      break;
    }
    case 'e':
    case 'ε':
      if (!appId) {
        alert('ID Αίτησης δεν έχει οριστεί. Ανανεώστε τη σελίδα πάνω σε μια αίτηση.');
        break;
      }
      const input = prompt('Επικόλλησε το JSON εισόδου για μαζική αντιγραφή ενοικιαστηρίων:');
      if (!input) break;
      let jsonInput;
      try {
        jsonInput = JSON.parse(input);
      } catch (e) {
        alert('Μη έγκυρο JSON.');
        break;
      }
      await handleOwnershipCopy(appId, jsonInput);
      break;
    case 'o': // Greek 'ο' might map to 'o'
    case 'ο':
      event.preventDefault();
  event.stopPropagation(); 
      togglePersistentPopup();
      break;
    case 'q':{
      const afm = await getAfmForApplication(appId || '');
      if (afm) {
        const unusedParcels = await findUnusedParcels(afm, appId || '');
        console.log('unusedParcels', unusedParcels);
      }
      break;
    }
    case 'μ':
    case 'm': {
      if (!appId) {
        alert('ID Αίτησης δεν έχει οριστεί. Ανανεώστε τη σελίδα πάνω σε μια αίτηση.');
        break;
      }
      try {
      let input = prompt('Επικόλλησε το JSON εισόδου για μαζική ενημέρωση:');
      if (!input) {input=JSON.stringify({
  "akrofysia": false,
  "exisotiki": false,
  "hlianthos_sumbasi": false,
  "lipasmata": false,
  "malakos_sitos": false,
  "skliros_sitos": false,
  "vamvaki": false,
  "viologiko": false,
  "timologia": []
},null,2);
      }
      let jsonInput;
      try {
        jsonInput = JSON.parse(input);
      } catch (e) {
        alert('Μη έγκυρο JSON.');
        break;
      }
      console.log('jsonInput', jsonInput);
      await handleMassUpdateFromJson(jsonInput, appId);
        await fetchApi('MainService/fetchOwnerAtakInfoFromAade?', { edeId: appId, forceUpdate: true, etos: EAE_YEAR });
        const edehdResponse = await fetchApi('Edetedeaeehd/findById', { id: appId });
        const afm = edehdResponse.data[0].afm;
        const keaStore = useKeaStore();
        const prevYearEdeResponse = await fetchApi('MainService/getEdesByAfm?', { str_afm: afm, str_UserType: keaStore.keaParams.gUserType, globalUserVat: keaStore.keaParams.globalUserVat, e_bi_gSubExt_id: keaStore.keaParams.e_bi_gSubExt_id, i_etos: EAE_YEAR - 1 });
        const prevYearEdeId = prevYearEdeResponse.data[0].id;
        const reportResponse = await fetchApi('Reports/ReportsBtnFrm_RepEdeCsBtn_action', { reportFormat: 1, BD_EDE_ID: prevYearEdeId, I_ETOS: EAE_YEAR - 1 });
        const base64String = reportResponse.data;
        const rawBinaryString = atob(base64String);
        const len = rawBinaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = rawBinaryString.charCodeAt(i);
        }
        const fileBlob = new Blob([bytes], { type: 'application/json' });
        const jsonData = JSON.parse(await fileBlob.text());
        const cleanedData = cleanGeospatialData(jsonData);
        
        const cleanedFileBlob = new Blob([JSON.stringify(cleanedData, null, 2)], { type: 'application/json' });
        const downloadUrl = window.URL.createObjectURL(cleanedFileBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${afm}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        alert(`Προέκυψε σφάλμα: ${(error as Error).message}`);
      }
      break;
    }
    case '1': {
      event.preventDefault();
  event.stopPropagation(); 
      // First, click the dropdown button to reveal the submenu
      // if I am at https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeehd, just navigate on tab 'Γενικ΄α Στοιχεία Αιτούντα'
      if (window.location.href.includes('#/Edetedeaeehd')) {
        await navigateToTab('Γενικά Στοιχεία Αιτούντα', '#/Edetedeaeehd');
        break;
      }
      // Find the dropdown button.
      const dropdownButton = document.querySelector("button.q-btn-dropdown");
      if (dropdownButton) {
        console.log("Extension: Clicking dropdown button to reveal submenu.", dropdownButton);
        (dropdownButton as HTMLButtonElement).click();
        // Wait a bit for the submenu to render
        await new Promise(resolve => setTimeout(resolve, 50));
      } else {
        console.warn("Extension: Dropdown button not found.");
        alert("Extension: Δεν βρέθηκε το κουμπί dropdown.");
        break;
      }
      //loop that tries 5 times to find the 'Γενικά Στοιχεία' button with 50ms delay between each try
      for (let i = 0; i < 5; i++) {
        const buttons = document.querySelectorAll("button.btn_primary");
        let targetButton: HTMLButtonElement | null = null;
        for (const button of Array.from(buttons)) {
          const span = button.querySelector("span.block");
          if (span && span.textContent?.trim() === 'Γενικά Στοιχεία') { 
            targetButton = button as HTMLButtonElement;
            break;
          }
        }
        if (targetButton) {
          console.log(`Extension: Clicking 'Γενικά Στοιχεία' button:`, targetButton);
          targetButton.click();
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Now, find and click the 'Γενικά Στοιχεία' button
      const buttons = document.querySelectorAll("button.btn_primary");
      let targetButton: HTMLButtonElement | null = null;
      for (const button of Array.from(buttons)) {
        const span = button.querySelector("span.block");
        if (span && span.textContent?.trim() === 'Γενικά Στοιχεία') {
          targetButton = button as HTMLButtonElement;
          break;
        }
      }
      break;
    }
    case '`': {
      // Ctrl + `
      try {
        const input = prompt('Επικόλλησε το JSON εισόδου για μαζική αντιγραφή ενοικιαστηρίων:');
        if (!input) break;
        let jsonInput;
        try {
          jsonInput = JSON.parse(input);
        } catch (e) {
          alert('Μη έγκυρο JSON.');
          break;
        }
        const appId = messageStore.currentApplicationId;
        if (!appId) {
          alert('ID Αίτησης δεν έχει οριστεί. Ανανεώστε τη σελίδα πάνω σε μια αίτηση.');
          break;
        }
    
      await handleOwnershipTry(appId, jsonInput);
      } catch (err) {
        console.error('Γενικό σφάλμα:', err);
        alert('Γενικό σφάλμα. Δες το console.');
      }
      break;
    }
    default:
      shortcutPerformed = false;
      break;
  }

  if (shortcutPerformed) {
    event.preventDefault();
    event.stopPropagation();
  }
}

export function initializeShortcuts() {
  document.addEventListener('keydown', handleShortcut);
  console.info("CS: Keyboard shortcuts initialized.");
}