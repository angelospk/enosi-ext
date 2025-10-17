// content-scripts/ui.ts

import ShortcutsModal from '../components/ShortcutsModal.vue';
import { createApp, ComponentPublicInstance, App as VueApp } from 'vue';
import PersistentIconPopup from '../components/PersistentIconPopup.vue';
import ErrorNotification from '../components/ErrorNotification.vue';
import { pinia } from './state'; // Import the shared pinia instance
import { sendMessage } from 'webext-bridge/content-script';
import type { BackgroundState } from '../types/bridge';
import type { ProcessedMessage } from '../stores/messages.store';

// --- Type definitions for Vue component instances ---
type PersistentIconPopupInstance = ComponentPublicInstance & {
  toggleVisibility: () => void;
  isVisible: boolean;
  hide: () => void;
};

type ShortcutsModalInstance = ComponentPublicInstance & {
  open: () => void;
  close: () => void;
};

// --- Module-level variables for UI elements ---
let persistentIconElement: HTMLElement | null = null;
let iconBadgeElement: HTMLSpanElement | null = null;
let persistentIconPopupVm: PersistentIconPopupInstance | null = null;
let shortcutsModalVm: ShortcutsModalInstance | null = null;

// --- State for UI visibility ---
let isUIVisible = true;
export const getIsUIVisible = () => isUIVisible;

function createPersistentIcon() {
  if (document.getElementById('my-extension-persistent-icon')) return;

  persistentIconElement = document.createElement('div');
  persistentIconElement.id = 'my-extension-persistent-icon';
  //commented out svg icon for now
  // persistentIconElement.innerHTML = `
  //     <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#333">
  //         <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
  //     </svg>`;
  const iconStyle = persistentIconElement.style;
  iconStyle.position = 'fixed';
  iconStyle.bottom = '0px';
  iconStyle.right = '15px';
  iconStyle.width = '60px';
  iconStyle.height = '24px';
  iconStyle.borderRadius = '50%';
  iconStyle.backgroundColor = '#f5f5f5';
  iconStyle.display = 'flex';
  iconStyle.alignItems = 'center';
  iconStyle.justifyContent = 'center';
  iconStyle.cursor = 'pointer';
  iconStyle.zIndex = '2147483640';
  iconStyle.boxShadow = '0 3px 10px rgba(0,0,0,0.2)';
  iconStyle.transition = 'transform 0.2s ease-out';

  persistentIconElement.onmouseenter = () => { iconStyle.transform = 'scale(1.1)'; };
  persistentIconElement.onmouseleave = () => { iconStyle.transform = 'scale(1)'; };

  persistentIconElement.addEventListener('click', async () => {
    if (!isUIVisible) return;
    persistentIconPopupVm?.toggleVisibility();
    await sendMessage('popup-visibility-changed', { visible: persistentIconPopupVm?.isVisible ?? false });
  });
  document.body.appendChild(persistentIconElement);

  // Create and append the badge element
  iconBadgeElement = document.createElement('span');
  iconBadgeElement.id = 'my-extension-icon-badge';
  const badgeStyle = iconBadgeElement.style;
  badgeStyle.position = 'absolute';
  badgeStyle.top = '0px';
  badgeStyle.right = '0px';
  // badgeStyle.background = 'red';
  badgeStyle.color = '#9e9e9e';
  badgeStyle.borderRadius = '10px';
  badgeStyle.padding = '1px 5px';
  badgeStyle.fontSize = '11px';
  badgeStyle.fontWeight = 'bold';
  badgeStyle.minWidth = '18px';
  badgeStyle.textAlign = 'center';
  badgeStyle.lineHeight = '16px';
  badgeStyle.display = 'none';
  badgeStyle.pointerEvents = 'none';
  persistentIconElement.appendChild(iconBadgeElement);

  // Create container for the popup and mount the Vue component
  const popupContainer = document.createElement('div');
  popupContainer.id = 'persistent-icon-popup-root';
  document.body.appendChild(popupContainer);

  const app = createApp(PersistentIconPopup);
  app.use(pinia); // Use the shared Pinia instance
  persistentIconPopupVm = app.mount(popupContainer) as PersistentIconPopupInstance;
}

function createShortcutsModal() {
  if (document.getElementById('shortcuts-modal-root')) return;
  const container = document.createElement('div');
  container.id = 'shortcuts-modal-root';
  document.body.appendChild(container);

  const app = createApp(ShortcutsModal);
  shortcutsModalVm = app.mount(container) as ShortcutsModalInstance;
}

/**
 * Updates the badge on the persistent icon based on change counters.
 * @param counters - The change counters from the background state.
 */
export function updateIconBadge(state: BackgroundState) {
  if (!iconBadgeElement) return;
  const { newErrors, newWarnings, newInfos, removedMessages } = state.changeCounters;
  //number of messages in the state
  const totalMessages = state.messages.length;
  const totalNew = newErrors + newWarnings + newInfos;

  if (totalNew > 0) {
    iconBadgeElement.textContent = totalNew.toString();
    iconBadgeElement.style.display = 'flex';
    iconBadgeElement.style.justifyContent = 'center';
    iconBadgeElement.style.alignItems = 'center';
    // add a + sign to the badge
    iconBadgeElement.textContent = `+${totalNew}(${totalMessages})`;
  //   if (newErrors > 0) iconBadgeElement.style.backgroundColor = 'red';
  //   else if (newWarnings > 0) iconBadgeElement.style.backgroundColor = 'orange';
  //   else iconBadgeElement.style.backgroundColor = 'dodgerblue';
  // } else if (removedMessages > 0 && totalNew === 0) {
  //   iconBadgeElement.textContent = `-${removedMessages}`;
  //   iconBadgeElement.style.backgroundColor = 'green';
  //   iconBadgeElement.style.display = 'flex';
  // } else {
  //   iconBadgeElement.style.display = 'none';
  // }
  }
  else if (removedMessages > 0) {
    iconBadgeElement.textContent = `-${removedMessages}(${totalMessages})`;
    iconBadgeElement.style.display = 'flex';
    iconBadgeElement.style.justifyContent = 'center';
    iconBadgeElement.style.alignItems = 'center';
    // iconBadgeElement.style.backgroundColor = 'green';
  }

}

/**
 * Triggers the display of error notifications.
 * @param messages - An array of messages to display.
 */
export function showErrorNotifications(messages: ProcessedMessage[]) {
  ErrorNotification?.showErrorNotifications(messages);
}

/**
 * Toggles the visibility of the entire extension UI on the page.
 */
export function toggleUIVisibility() {
  isUIVisible = !isUIVisible; // Toggle the state

  if (persistentIconElement) {
    persistentIconElement.style.display = isUIVisible ? 'flex' : 'none';
  }

  // Also hide the popup if we are hiding the icon
  if (!isUIVisible) {
    persistentIconPopupVm?.hide();
  }

  console.info(`Extension: UI elements ${isUIVisible ? 'shown' : 'hidden'}.`);
}

/**
 * Toggles the main persistent popup.
 */
export function toggleShortcutsModal() {
    shortcutsModalVm?.open();
}
export function togglePersistentPopup() {
    persistentIconPopupVm?.toggleVisibility();
}

/**
 * Initializes all persistent UI components.
 */
export function initializeUI() {
  createPersistentIcon();
  // createErrorNotificationSystem();
  createShortcutsModal();
}