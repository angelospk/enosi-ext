import { createApp, App as VueApp, ref } from 'vue';
import CommunityPopup from '../components/CommunityPopup.vue';
import PersistentIconPopup from '../components/PersistentIconPopup.vue'; // Import the new component
import { createPinia } from 'pinia';

// --- Interfaces ---
interface CommunityItemRaw {
  id: string;
  kodikos: string;
  description: string;
  lkpenId?: { id: string; kodikos: string; description: string; };
}
interface CommunityItem { kodikos: string; description: string; }

// --- State Variables ---
let communityVueApp: VueApp<Element> | null = null;
let communityPopupVm: any = null;
let communityPopupContainer: HTMLDivElement | null = null;
let currentCommunityTargetInput: HTMLInputElement | null = null;
let communityHelperInitialized = false;

let persistentIconVueApp: VueApp<Element> | null = null;
let persistentIconPopupVm: any = null;
let persistentIconElement: HTMLElement | null = null;
let persistentIconPopupContainer: HTMLDivElement | null = null;


// --- Helper: Find Input Element by Label ---
function findInputElementByLabelText(labelText: string): HTMLInputElement | null {
    const labels = document.querySelectorAll<HTMLLabelElement>('label.q-field');
    for (const label of labels) {
        const pElement = label.querySelector<HTMLParagraphElement>('.q-field__label p.text-weight-bold.text-body1');
        if (pElement) {
            const pClone = pElement.cloneNode(true) as HTMLParagraphElement;
            const asteriskSpan = pClone.querySelector('span.text-weight-bolder.text-negative');
            if (asteriskSpan) {
                asteriskSpan.remove();
            }
            const actualLabelText = pClone.textContent?.trim() || "";

            if (actualLabelText.startsWith(labelText)) {
                const inputElement = label.querySelector<HTMLInputElement>('input.q-field__native');
                if (inputElement) return inputElement;
            }
        }
    }
    // console.warn(`Extension: Could not find input field associated with label "${labelText}"`);
    return null;
}

// --- Helper: Apply Code to Page (for Community Helper) ---
async function applyCodeToPage(inputField: HTMLInputElement, code: string) {
    console.log(`Extension: Applying code '${code}' to input field:`, inputField);
    inputField.focus();
    inputField.value = code;

    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    inputField.dispatchEvent(inputEvent);
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    inputField.dispatchEvent(changeEvent);
    inputField.blur();

    await new Promise(resolve => setTimeout(resolve, 50));
    console.log(`Extension: Code '${code}' applied and events dispatched.`);
}

// --- API Fetching (for Community Helper) ---
async function fetchCommunityData(sLkpenId_id: string): Promise<CommunityItem[]> {
    try {
        console.log("Extension: Fetching community data with sLkpenId_id:", sLkpenId_id);
        // IMPORTANT: This ID (sLkpenId_id) might need to be dynamic based on another field's value.
        // The example uses a static ID "XrAHzIAvvQP8XPX2h8NHRQ==".
        // You may need to implement logic to retrieve this dynamically from the page
        // if it changes based on user selections in preceding fields.
        const response = await fetch("https://eae2024.opekepe.gov.gr/eae2024/rest/LandKalkoinotite/findAllByCriteriaRange_LandKalkoinotiteGrpLandKalkoinotite", {
            headers: {
                "accept": "application/json, text/plain, */*",
                "accept-language": "el-GR,el;q=0.7",
                "cache-control": "no-cache",
                "content-type": "application/json",
                "pragma": "no-cache",
                "sec-ch-ua": "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not-A.Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
            },
            referrer: "https://eae2024.opekepe.gov.gr/eae2024/",
            referrerPolicy: "strict-origin-when-cross-origin",
            body: JSON.stringify({
                "sLkpenId_id": sLkpenId_id,
                "fromRowIndex": 0,
                "toRowIndex": 2000,
                "exc_Id": [],
                "sortField": "description",
                "sortOrder": true
            }),
            method: "POST",
            mode: "cors",
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
        }
        const jsonData = await response.json();
        if (jsonData && jsonData.data) {
            console.log("Extension: Community data fetched successfully", jsonData.data.length, "items");
            return jsonData.data.map((item: CommunityItemRaw) => ({
                kodikos: item.kodikos,
                description: item.description,
            }));
        }
        return [];
    } catch (error) {
        console.error("Extension: Failed to fetch community data:", error);
        return [];
    }
}

// --- Community Helper Specific Functions ---
function setupCommunityPopupForInput(targetInput: HTMLInputElement, communityData: CommunityItem[]) {
    if (communityPopupContainer && communityPopupContainer.parentElement) {
        communityPopupContainer.remove(); // Clean up old one
    }
    communityPopupContainer = document.createElement('div');
    communityPopupContainer.id = 'community-helper-popup-container';

    const qFieldElement = targetInput.closest('.q-field');
    if (qFieldElement) {
        qFieldElement.style.position = 'relative'; // For absolute positioning of popup
        qFieldElement.appendChild(communityPopupContainer); // Append inside q-field for better relative positioning
        communityPopupContainer.style.position = 'absolute';
        communityPopupContainer.style.left = '0';
        communityPopupContainer.style.top = targetInput.offsetHeight + 'px'; // Position below the input part of q-field
        communityPopupContainer.style.width = qFieldElement.offsetWidth + 'px';
    } else {
        targetInput.parentNode?.insertBefore(communityPopupContainer, targetInput.nextSibling);
    }

    communityVueApp = createApp(CommunityPopup, { items: communityData, targetInput: targetInput });
    communityPopupVm = communityVueApp.mount(communityPopupContainer);

    communityPopupContainer.addEventListener('community-item-selected', (event: Event) => {
        const customEvent = event as CustomEvent<CommunityItem>;
        if (customEvent.detail?.kodikos) {
            applyCodeToPage(targetInput, customEvent.detail.kodikos).then(() => {
                if (communityPopupVm?.hide) communityPopupVm.hide();
            });
        }
    });
}

function handleCommunityInputInteraction(inputElement: HTMLInputElement) {
    currentCommunityTargetInput = inputElement;
    inputElement.addEventListener('input', () => {
        if (communityPopupVm?.setFilterText) {
            communityPopupVm.setFilterText(inputElement.value);
            if (inputElement.value.length > 0 && communityPopupVm.show) communityPopupVm.show();
            else if (inputElement.value.length === 0 && communityPopupVm.hide) communityPopupVm.hide();
        }
    });
    inputElement.addEventListener('focus', () => {
        if (communityPopupVm?.setFilterText) communityPopupVm.setFilterText(inputElement.value);
        if (communityPopupVm?.show) communityPopupVm.show();
    });
    inputElement.addEventListener('keydown', (event: KeyboardEvent) => {
        if (!communityPopupVm) return;
        const actions = {
            'ArrowDown': () => { event.preventDefault(); communityPopupVm.show?.(); communityPopupVm.navigate?.('down'); },
            'ArrowUp': () => { event.preventDefault(); communityPopupVm.show?.(); communityPopupVm.navigate?.('up'); },
            'Enter': () => { event.preventDefault(); communityPopupVm.confirmSelection?.(); },
            'Tab': () => { if(communityPopupVm.isVisible) {event.preventDefault(); communityPopupVm.confirmSelection?.();} }, // Only prevent tab if popup is active
            'Escape': () => communityPopupVm.hide?.()
        };
        actions[event.key]?.();
    });
}

async function initializeCommunityHelper() {
    if (communityHelperInitialized || !window.location.href.startsWith('https://eae2024.opekepe.gov.gr/eae2024')) {
        return;
    }
    console.log("Extension: Attempting to initialize Community Helper.");

    const targetLabelText = 'Δημοτική-Τοπική Κοινότητα';
    const targetInput = findInputElementByLabelText(targetLabelText);

    if (targetInput) {
        console.log("Extension: Target input for Community Helper found:", targetInput);
        // Static ID for now, see comment in fetchCommunityData for making it dynamic
        const sLkpenId_id_for_fetch = "XrAHzIAvvQP8XPX2h8NHRQ==";
        const communityData = await fetchCommunityData(sLkpenId_id_for_fetch);

        if (communityData.length > 0) {
            setupCommunityPopupForInput(targetInput, communityData);
            handleCommunityInputInteraction(targetInput);
            communityHelperInitialized = true; // Mark as initialized
            console.log("Extension: Community Helper initialized.");
        } else {
            console.log("Extension: No community data for Community Helper.");
        }
    } else {
        // console.log("Extension: Target input for Community Helper not found on this check.");
    }
}

// --- Persistent Icon & Its Popup Functions ---
function createPersistentIcon() {
    if (document.getElementById('my-extension-persistent-icon')) return; // Already created

    persistentIconElement = document.createElement('div'); // Use div for easier styling if SVG is complex
    persistentIconElement.id = 'my-extension-persistent-icon';

    // Basic styling, can be improved with an actual SVG icon
    persistentIconElement.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
        </svg>
    `;
    const iconStyle = persistentIconElement.style;
    iconStyle.position = 'fixed';
    iconStyle.bottom = '20px';
    iconStyle.right = '20px';
    iconStyle.width = '48px';
    iconStyle.height = '48px';
    iconStyle.borderRadius = '50%';
    iconStyle.backgroundColor = '#f0f0f0'; // Example color
    iconStyle.display = 'flex';
    iconStyle.alignItems = 'center';
    iconStyle.justifyContent = 'center';
    iconStyle.cursor = 'pointer';
    iconStyle.zIndex = '2147483646';
    iconStyle.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    // try { // In case browser.runtime.getURL is not available in all contexts as expected
    //   persistentIconElement.src = browser.runtime.getURL('src/assets/persistent-icon.svg');
    // } catch (e) {
    //   console.warn("Extension: Could not load icon from assets. Using placeholder.", e);
    //   persistentIconElement.textContent = "💡"; // Placeholder if SVG fails
    //   iconStyle.padding = "10px";
    //   iconStyle.fontSize = "24px";
    // }


    persistentIconElement.addEventListener('click', togglePersistentIconPopup);
    document.body.appendChild(persistentIconElement);

    // Create container for the persistent icon's Vue popup (initially hidden)
    persistentIconPopupContainer = document.createElement('div');
    persistentIconPopupContainer.id = 'persistent-icon-popup-root';
    document.body.appendChild(persistentIconPopupContainer);

    const piniaInstance = createPinia(); // Create a Pinia instance for this app

    persistentIconVueApp = createApp(PersistentIconPopup, {});
    persistentIconVueApp.use(piniaInstance); // Use Pinia for this Vue app
    persistentIconPopupVm = persistentIconVueApp.mount(persistentIconPopupContainer);
}

function togglePersistentIconPopup() {
    if (persistentIconPopupVm?.toggleVisibility) {
        persistentIconPopupVm.toggleVisibility();
    }
}

// --- Main Initialization and Observation ---
function main() {
    if (!window.location.href.startsWith('https://eae2024.opekepe.gov.gr/eae2024')) {
        return;
    }

    // Create the persistent icon as soon as the content script runs on a matching page
    createPersistentIcon();

    // Attempt to initialize the community helper immediately
    initializeCommunityHelper();

    // Observe for dynamic changes in case the community input field loads later
    const observer = new MutationObserver(() => {
        if (!communityHelperInitialized) { // Only try to initialize if not already done
            initializeCommunityHelper();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}