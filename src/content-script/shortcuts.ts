// content-scripts/shortcuts.ts

import { messageStore } from './state';
import { toggleUIVisibility, togglePersistentPopup } from './ui';
import { copyAgrotemaxioData, copyBioflagToTargets } from './opekepe_actions';

async function navigateToTab(tabText: string, requiredBaseUrlPath: string): Promise<boolean> {
  const currentPath = window.location.hash;
  if (!currentPath.startsWith(requiredBaseUrlPath)) {
    const mainPageUrl = `https://eae2024.opekepe.gov.gr/eae2024/${requiredBaseUrlPath}`;
    window.location.href = mainPageUrl;
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for navigation
  }

  await new Promise(resolve => setTimeout(resolve, 500)); // Wait for tabs to render

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
  if (!event.ctrlKey) return;

  let shortcutPerformed = true;
  const key = event.key.toLowerCase();
  const appId = messageStore.currentApplicationId;

  switch (key) {
    case '1':
      if (appId) window.location.href = `https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeehd?id=${appId}`;
      // else alert("ID Αίτησης δεν έχει οριστεί.");
      break;
    case '2':
      if (appId) await navigateToTab('Συγκατάθεση GDPR', `#/Edetedeaeehd?id=${appId}`);
      // else alert("ID Αίτησης δεν έχει οριστεί.");
      break;
    case '3':
      window.location.href = 'https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeemetcom';
      break;
    case '4':
      window.location.href = 'https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeeagroi';
      break;
    case '5':
      await navigateToTab('Ιδιοκτησία', '#/Edetedeaeeagroi');
      break;
    case '6':
      await navigateToTab('Οικολογικά Σχήματα', '#/Edetedeaeeagroi');
      break;
    case '7':
      await navigateToTab('Φυτικό Κεφάλαιο', '#/Edetedeaeeagroi');
      break;
    case '9':
      window.location.href = 'https://eae2024.opekepe.gov.gr/eae2024/#/Edetedeaeedikaiol';
      break;
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
    case 'o': // Greek 'ο' might map to 'o'
    case 'ο':
      togglePersistentPopup();
      break;
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