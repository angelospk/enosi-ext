// content-scripts/ui.ts

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

type ErrorNotificationInstance = ComponentPublicInstance & {
  showErrorNotifications: (messages: ProcessedMessage[]) => void;
};

// --- Module-level variables for UI elements ---
let persistentIconElement: HTMLElement | null = null;
let iconBadgeElement: HTMLSpanElement | null = null;
let persistentIconPopupVm: PersistentIconPopupInstance | null = null;
let errorNotificationVm: ErrorNotificationInstance | null = null;

// --- State for UI visibility ---
let isUIVisible = true;
export const getIsUIVisible = () => isUIVisible;

function createPersistentIcon() {
  if (document.getElementById('my-extension-persistent-icon')) return;

  persistentIconElement = document.createElement('div');
  persistentIconElement.id = 'my-extension-persistent-icon';
  persistentIconElement.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#333">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
      </svg>`;
  const iconStyle = persistentIconElement.style;
  iconStyle.position = 'fixed';
  iconStyle.bottom = '15px';
  iconStyle.right = '15px';
  iconStyle.width = '48px';
  iconStyle.height = '48px';
  iconStyle.borderRadius = '50%';
  iconStyle.backgroundColor = 'rgba(255, 255, 255, 0.9)';
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
  badgeStyle.background = 'red';
  badgeStyle.color = 'white';
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

function createErrorNotificationSystem() {
  if (document.getElementById('my-extension-error-notification-root')) return;
  const container = document.createElement('div');
  container.id = 'my-extension-error-notification-root';
  document.body.appendChild(container);

  const app = createApp(ErrorNotification);
  // This component doesn't need Pinia directly, it's controlled via methods
  errorNotificationVm = app.mount(container) as ErrorNotificationInstance;
}

/**
 * Updates the badge on the persistent icon based on change counters.
 * @param counters - The change counters from the background state.
 */
export function updateIconBadge(counters: BackgroundState['changeCounters']) {
  if (!iconBadgeElement) return;
  const { newErrors, newWarnings, newInfos, removedMessages } = counters;
  const totalNew = newErrors + newWarnings + newInfos;

  if (totalNew > 0) {
    iconBadgeElement.textContent = totalNew.toString();
    iconBadgeElement.style.display = 'flex';
    iconBadgeElement.style.justifyContent = 'center';
    iconBadgeElement.style.alignItems = 'center';
    if (newErrors > 0) iconBadgeElement.style.backgroundColor = 'red';
    else if (newWarnings > 0) iconBadgeElement.style.backgroundColor = 'orange';
    else iconBadgeElement.style.backgroundColor = 'dodgerblue';
  } else if (removedMessages > 0 && totalNew === 0) {
    iconBadgeElement.textContent = `-${removedMessages}`;
    iconBadgeElement.style.backgroundColor = 'green';
    iconBadgeElement.style.display = 'flex';
  } else {
    iconBadgeElement.style.display = 'none';
  }
}

/**
 * Triggers the display of error notifications.
 * @param messages - An array of messages to display.
 */
export function showErrorNotifications(messages: ProcessedMessage[]) {
  errorNotificationVm?.showErrorNotifications(messages);
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
export function togglePersistentPopup() {
    persistentIconPopupVm?.toggleVisibility();
}

/**
 * Initializes all persistent UI components.
 */
export function initializeUI() {
  createPersistentIcon();
  createErrorNotificationSystem();
}