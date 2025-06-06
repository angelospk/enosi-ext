import { createApp, App as VueApp, ref, watch as vueWatch, nextTick } from 'vue';
import PersistentIconPopup from '../components/PersistentIconPopup.vue';
import ErrorNotification from '../components/ErrorNotification.vue';
import { createPinia, Pinia, Store } from 'pinia'; // Θα χρησιμοποιήσουμε ένα "dummy" store στο content-script
                                                // για να κρατάμε την κατάσταση που έρχεται από το background.
import { type BackgroundState } from '../types/bridge'; // Ελέγξτε τη διαδρομή
import { useMessageStore } from '../stores/messages.store'; // Για τον τύπο και τοπική χρήση
import { sendMessage, onMessage } from 'webext-bridge/content-script';
import browser from 'webextension-polyfill';


console.info("Extension: Content script loaded.");

// --- State Variables (Τοπική Κατάσταση Αντίγραφο του Store) ---
const localBackgroundState = ref<BackgroundState>({
  currentApplicationId: null,
  messages: [],
  isLoading: true,
  lastError: null,
  changeCounters: { newErrors: 0, newWarnings: 0, newInfos: 0, removedMessages: 0 },
});

// Pinia instance για τα Vue components στο content script.
// Δεν θα συγχρονίζεται αυτόματα με το background, αλλά θα το ενημερώνουμε μέσω webext-bridge.
const piniaInstanceForContentScript: Pinia = createPinia();
let localMessageStore: ReturnType<typeof useMessageStore> = useMessageStore(piniaInstanceForContentScript); // Τοπικό store για τα components


// Vue app instances (παραμένουν)





let persistentIconVueApp: VueApp<Element> | null = null;
let persistentIconPopupVm: any = null;
let persistentIconElement: HTMLElement | null = null;
let persistentIconPopupContainer: HTMLDivElement | null = null;

let errorNotificationVueApp: VueApp<Element> | null = null;
let errorNotificationVm: any = null;
let errorNotificationContainer: HTMLDivElement | null = null;




// --- Icon Badge & Error Notification ---
let iconBadgeElement: HTMLSpanElement | null = null;

// --- Persistent Icon & UI (Παραμένει η λογική UI) ---
function setupPersistentIconAndBadge() {
    if (document.getElementById('my-extension-persistent-icon')) return;

    persistentIconElement = document.createElement('div');
    persistentIconElement.id = 'my-extension-persistent-icon';
    persistentIconElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#333">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>`;
    const iconStyle = persistentIconElement.style;
    iconStyle.position = 'fixed'; /* ... άλλες ιδιότητες CSS ... */
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
      persistentIconPopupVm?.toggleVisibility();
      if (persistentIconPopupVm?.isVisible) { // Αν το popup έγινε ορατό
        await sendMessage('popup-visibility-changed', { visible: true });
      } else {
        await sendMessage('popup-visibility-changed', { visible: false });
      }
    });
    document.body.appendChild(persistentIconElement);

    iconBadgeElement = document.createElement('span');
    /* ... CSS για το badge ... */
    iconBadgeElement.id = 'my-extension-icon-badge';
    const badgeStyle = iconBadgeElement.style;
    badgeStyle.position = 'absolute';
    badgeStyle.top = '0px';
    badgeStyle.right = '0px';
    badgeStyle.background = 'red'; // Default to red
    badgeStyle.color = 'white';
    badgeStyle.borderRadius = '10px';
    badgeStyle.padding = '1px 5px';
    badgeStyle.fontSize = '11px';
    badgeStyle.fontWeight = 'bold';
    badgeStyle.minWidth = '18px';
    badgeStyle.textAlign = 'center';
    badgeStyle.lineHeight = '16px';
    badgeStyle.display = 'none'; // Initially hidden
    badgeStyle.pointerEvents = 'none';
    persistentIconElement.appendChild(iconBadgeElement);

    persistentIconPopupContainer = document.createElement('div');
    persistentIconPopupContainer.id = 'persistent-icon-popup-root';
    document.body.appendChild(persistentIconPopupContainer);

    // Το PersistentIconPopup θα χρησιμοποιήσει το τοπικό Pinia store
    // που ενημερώνεται από το background.
    persistentIconVueApp = createApp(PersistentIconPopup);
    persistentIconVueApp.use(piniaInstanceForContentScript); // Χρήση του τοπικού Pinia
    persistentIconPopupVm = persistentIconVueApp.mount(persistentIconPopupContainer);
}

function updateIconBadgeOnUI(counters: BackgroundState['changeCounters']) {
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
      iconBadgeElement.style.justifyContent = 'center';
      iconBadgeElement.style.alignItems = 'center';
  } else {
      iconBadgeElement.style.display = 'none';
  }
}

function setupErrorNotificationSystemOnUI() {
  if (errorNotificationContainer) return;
  errorNotificationContainer = document.createElement('div');
  errorNotificationContainer.id = 'my-extension-error-notification-root';
  document.body.appendChild(errorNotificationContainer);

  errorNotificationVueApp = createApp(ErrorNotification);
  // Το ErrorNotification δεν χρειάζεται άμεση πρόσβαση στο store εδώ,
  // θα καλείται η μέθοδός του showErrorNotifications από το onMessage.
  errorNotificationVm = errorNotificationVueApp.mount(errorNotificationContainer);
}


// --- Επικοινωνία με το Background Script ---
async function requestInitialStateFromBackground() {
  try {
    const initialState = await sendMessage('get-initial-state', null);
    if (initialState && typeof initialState === 'object' && 'currentApplicationId' in initialState) {
      const state = initialState as unknown as BackgroundState;
      localBackgroundState.value = {
        currentApplicationId: state.currentApplicationId,
        messages: state.messages,
        isLoading: state.isLoading,
        lastError: state.lastError,
        changeCounters: state.changeCounters,
      };
      if (localMessageStore) {
        localMessageStore.currentApplicationId = state.currentApplicationId;
        localMessageStore.messages = state.messages;
        localMessageStore.isLoading = state.isLoading;
        localMessageStore.lastError = state.lastError;
        localMessageStore.changeCounters = state.changeCounters;
      }
    }
  } catch (e) {
    console.warn("CS: Failed to get initial state", e);
  }
}

// Listen for messages from background script
onMessage('state-updated', (message) => {
  const data = message.data as unknown as {
    currentApplicationId: string | null;
    messages: ProcessedMessage[];
    isLoading: boolean;
    lastError: string | null;
    changeCounters: {
      newErrors: number;
      newWarnings: number;
      newInfos: number;
      removedMessages: number;
    };
  };

  if (!data || typeof data !== 'object') {
    console.error("CS: Received invalid state update:", data);
    return;
  }

  console.info("CS: Received state update:", {
    appId: data.currentApplicationId,
    messageCount: data.messages?.length || 0,
    isLoading: data.isLoading,
    hasError: !!data.lastError
  });

  if (localMessageStore) {
    localMessageStore.$patch({
      currentApplicationId: data.currentApplicationId,
      messages: data.messages || [],
      isLoading: data.isLoading,
      lastError: data.lastError,
      changeCounters: data.changeCounters || {
        newErrors: 0,
        newWarnings: 0,
        newInfos: 0,
        removedMessages: 0
      }
    });
    console.info("CS: Local store updated with messages:", data.messages?.length || 0);
  }
});

onMessage('show-error-notifications', ({ data }) => {
  if (data && Array.isArray(data) && errorNotificationVm?.showErrorNotifications) {
    errorNotificationVm.showErrorNotifications(data);
  }
});

onMessage('clear-change-counters', () => {
  if (localMessageStore) {
    localMessageStore.clearChangeCounters();
  }
});

// --- Παρακολούθηση URL (απλοποιημένη στο content script, στέλνει το URL στο background) ---
let lastCheckedUrlForCS = "";
function checkUrlAndNotifyBackground() {
    const currentHref = window.location.href;
    if (currentHref !== lastCheckedUrlForCS) {
        lastCheckedUrlForCS = currentHref;
        if (currentHref.startsWith("https://eae2024.opekepe.gov.gr/eae2024/")) {
            sendMessage('url-changed-for-id-check', { url: currentHref })
                .catch(e => console.warn("Extension (CS): Failed to send URL change to background", e));
        }
    }
}


// --- Κύρια Λογική Εκκίνησης στο Content Script ---
async function mainContentScript() {
  if (!window.location.href.startsWith('https://eae2024.opekepe.gov.gr/eae2024')) {
    return;
  }
  // console.log("Extension (CS): mainContentScript() called.");

  // Αρχικοποίηση τοπικού store (θα ενημερώνεται από το background)
  localMessageStore = useMessageStore(piniaInstanceForContentScript);
  localMessageStore.$patch({
    messages: [],
    currentApplicationId: null,
    isLoading: false,
    lastError: null,
    changeCounters: { newErrors: 0, newWarnings: 0, newInfos: 0, removedMessages: 0 },
    permanentlyDismissedMessageIds: []
  });

  setupPersistentIconAndBadge();
  setupErrorNotificationSystemOnUI();
  // initializeCommunityHelper(); // Προσπαθεί να αρχικοποιήσει το community helper UI
  console.info("Extension (CS): mainContentScript() finished.");
  await requestInitialStateFromBackground();

  // Παρακολούθηση αλλαγών URL για SPAs
  // Ο κύριος έλεγχος URL γίνεται στο background, αλλά στέλνουμε και από εδώ για σιγουριά
  checkUrlAndNotifyBackground();
  const navigationObserver = new MutationObserver(() => {
      checkUrlAndNotifyBackground();
  });
  navigationObserver.observe(document.documentElement, { childList: true, subtree: true }); // Observe for SPA navigations
  console.info("Extension (CS): Navigation observer started.");
  // Για το hashchange που δεν πιάνει πάντα ο MutationObserver
  window.addEventListener('hashchange', checkUrlAndNotifyBackground);
  console.info("Extension (CS): Hashchange listener added.");
}

// Εκκίνηση
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mainContentScript);
} else {
  mainContentScript();
}