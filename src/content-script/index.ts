import { createApp, App as VueApp, computed, ref } from 'vue';
import CommunityPopup from '../components/CommunityPopup.vue';
import PersistentIconPopup from '../components/PersistentIconPopup.vue'; // Import the new component

// --- Interfaces ---
interface CommunityItemRaw {
  id: string;
  kodikos: string;
  description: string;
  lkpenId?: { id: string; kodikos: string; description: string; };
}
interface CommunityItem { kodikos: string; description: string; }

// --- State Variables ---
const initializedCommunityInputs = new WeakSet<HTMLInputElement>(); // Track initialized inputs

let communityVueApp: VueApp<Element> | null = null;
let communityPopupVm: any = null;
let communityPopupContainer: HTMLDivElement | null = null;
let currentCommunityTargetInput: HTMLInputElement | null = null;
let communityHelperInitialized = false;

let persistentIconVueApp: VueApp<Element> | null = null;
let persistentIconPopupVm: any = null;
let persistentIconElement: HTMLElement | null = null;
let persistentIconPopupContainer: HTMLDivElement | null = null;

// --- Helper: Find ALL Input Elements by Label ---
function findAllCommunityInputFields(labelText: string): HTMLInputElement[] {
    const inputs: HTMLInputElement[] = [];
    const labels = document.querySelectorAll<HTMLLabelElement>('label.q-field');
    labels.forEach(label => {
        const pElement = label.querySelector<HTMLParagraphElement>('.q-field__label p.text-weight-bold.text-body1');
        if (pElement) {
            // Clone to avoid modifying the live DOM element if we were to remove children
            const pClone = pElement.cloneNode(true) as HTMLParagraphElement;
            // Attempt to remove the asterisk span more robustly
            const asteriskSpan = pClone.querySelector('span.text-weight-bolder.text-negative');
            if (asteriskSpan) {
                asteriskSpan.remove();
            }
            const actualLabelText = pClone.textContent?.trim() || "";

            if (actualLabelText.startsWith(labelText)) {
                const inputElement = label.querySelector<HTMLInputElement>('input.q-field__native');
                if (inputElement) {
                    inputs.push(inputElement);
                }
            }
        }
    });
    return inputs;
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
    inputField.blur(); // Important to trigger any on-blur logic the page might have

    await new Promise(resolve => setTimeout(resolve, 50)); // Short delay
    console.log(`Extension: Code '${code}' applied and events dispatched.`);
}

// --- API Fetching (for Community Helper) ---
// Cache for fetched community data based on sLkpenId_id
const communityDataCache = new Map<string, CommunityItem[]>();

async function fetchCommunityData(sLkpenId_id: string): Promise<CommunityItem[]> {
    if (communityDataCache.has(sLkpenId_id)) {
        console.log("Extension: Using cached community data for sLkpenId_id:", sLkpenId_id);
        return communityDataCache.get(sLkpenId_id)!;
    }
    try {
        console.log("Extension: Fetching community data with sLkpenId_id:", sLkpenId_id);
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
            body: JSON.stringify({
                "sLkpenId_id": sLkpenId_id,
                "fromRowIndex":0,
                "toRowIndex":2000,
                "exc_Id":[],
                "sortField":"description",
                "sortOrder":true
            }),
            method: "POST",
            mode: "cors",
            credentials: "include"
            // ... (method, mode, credentials as before) ...
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
        }
        const jsonData = await response.json();
        if (jsonData && jsonData.data) {
            const mappedData = jsonData.data.map((item: CommunityItemRaw) => ({
                kodikos: item.kodikos,
                description: item.description,
            }));
            communityDataCache.set(sLkpenId_id, mappedData); // Cache the result
            console.log("Extension: Community data fetched and cached", mappedData.length, "items for", sLkpenId_id);
            return mappedData;
        }
        return [];
    } catch (error) {
        console.error("Extension: Failed to fetch community data for", sLkpenId_id, error);
        return [];
    }
}

function setupCommunityPopupForSingleInput(targetInput: HTMLInputElement, communityData: CommunityItem[]) {
    // ... (popup container creation logic) ...

    const vueApp = createApp(CommunityPopup, { items: communityData, targetInput: targetInput });
    const vm = vueApp.mount(localPopupContainer) as any; // Cast to any or a more specific type if you define one

    // ... (event listener for 'community-item-selected') ...

    targetInput.addEventListener('input', () => {
        if (vm?.setFilterText) {
            vm.setFilterText(targetInput.value);
            // Access .value of the exposed ComputedRef and then its length
            if (targetInput.value.length > 0 && vm.show && vm.currentFilteredItems?.value?.length > 0) {
                vm.show();
            } else if (vm.hide) {
                vm.hide();
            }
        }
    });

    targetInput.addEventListener('focus', () => {
        if (vm?.setFilterText) vm.setFilterText(targetInput.value);
        // Access .value of the exposed ComputedRef and then its length
        if (vm?.show && vm.currentFilteredItems?.value?.length > 0) {
            vm.show();
        }
    });

    targetInput.addEventListener('keydown', (event: KeyboardEvent) => {
        if (!vm) return;
        // Use the exposed reactive properties
        const isPopupVisible = vm.isPopupVisible?.value;
        const currentHasSelection = vm.hasSelection?.value;

        const actions: Record<string, () => void> = {
            'ArrowDown': () => { event.preventDefault(); vm.show?.(); vm.navigate?.('down'); },
            'ArrowUp': () => { event.preventDefault(); vm.show?.(); vm.navigate?.('up'); },
            'Enter': () => { if (isPopupVisible && currentHasSelection) { event.preventDefault(); vm.confirmSelection?.(); } },
            'Tab': () => {
                // Only interfere with Tab if the popup is visible and has a potential selection
                if (isPopupVisible && currentHasSelection) {
                    event.preventDefault();
                    vm.confirmSelection?.();
                } else if (isPopupVisible) {
                    // If popup is visible but no selection, just hide it and let tab do its default
                    vm.hide?.();
                }
            },
            'Escape': () => { if (isPopupVisible) vm.hide?.(); }
        };
        actions[event.key]?.();
    });
    console.log(`Extension: Community Helper setup for input:`, targetInput);
}


async function scanAndInitializeCommunityHelpers() {
    if (!window.location.href.startsWith('https://eae2024.opekepe.gov.gr/eae2024')) {
        return;
    }
    // console.log("Extension: Scanning for Community Helper targets.");

    const targetLabelText = 'Δημοτική-Τοπική Κοινότητα';
    const targetInputs = findAllCommunityInputFields(targetLabelText);

    if (targetInputs.length > 0) {
        // TODO: Determine sLkpenId_id dynamically if it varies per input.
        // For now, using a static one. If dynamic, this fetch might need to be inside the loop
        // or data fetched per unique sLkpenId_id.
        const sLkpenId_id_for_fetch = "XrAHzIAvvQP8XPX2h8NHRQ==";
        const communityData = await fetchCommunityData(sLkpenId_id_for_fetch);

        if (communityData.length === 0 && sLkpenId_id_for_fetch) { // Only warn if we expected data
            console.log("Extension: No community data fetched, cannot initialize helpers for sLkpenId:", sLkpenId_id_for_fetch);
            return;
        }

        for (const input of targetInputs) {
            if (!initializedCommunityInputs.has(input)) {
                if (communityData.length > 0) { // Only setup if we have data for this ID
                    setupCommunityPopupForSingleInput(input, communityData);
                }
                initializedCommunityInputs.add(input);
            }
        }
    }
}

// --- Persistent Icon & Its Popup Functions ---
function createPersistentIcon() {
    if (document.getElementById('my-extension-persistent-icon')) return; // Already created

    persistentIconElement = document.createElement('div'); // Use div for easier styling if SVG is complex
    persistentIconElement.id = 'my-extension-persistent-icon';

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

    persistentIconElement.addEventListener('click', togglePersistentIconPopup);
    document.body.appendChild(persistentIconElement);

    persistentIconPopupContainer = document.createElement('div');
    persistentIconPopupContainer.id = 'persistent-icon-popup-root';
    document.body.appendChild(persistentIconPopupContainer);

    persistentIconVueApp = createApp(PersistentIconPopup, {});
    persistentIconPopupVm = persistentIconVueApp.mount(persistentIconPopupContainer);
}

function togglePersistentIconPopup() {
    if (persistentIconPopupVm?.toggleVisibility) {
        persistentIconPopupVm.toggleVisibility();
    }
}

// --- Main Initialization and Observation ---
let debounceScanTimer: number | undefined;
function debouncedScanAndInitialize() {
    clearTimeout(debounceScanTimer);
    debounceScanTimer = window.setTimeout(scanAndInitializeCommunityHelpers, 500); // Debounce
}

function main() {
    if (!window.location.href.startsWith('https://eae2024.opekepe.gov.gr/eae2024')) {
        return;
    }
    console.log("Extension: Content script main() called.");
    createPersistentIcon();
    debouncedScanAndInitialize(); // Initial scan

    const observer = new MutationObserver((mutationsList) => {
        let potentiallyRelevantChange = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const element = node as HTMLElement;
                        // Check if the added node itself or its descendants match our target criteria
                        if (element.matches?.('label.q-field, .q-field') || element.querySelector('label.q-field, input.q-field__native')) {
                            potentiallyRelevantChange = true;
                            break;
                        }
                    }
                }
            }
            if (potentiallyRelevantChange) break;
        }

        if (potentiallyRelevantChange) {
            // console.log("Extension: Potentially relevant DOM change detected, rescanning.");
            debouncedScanAndInitialize();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}