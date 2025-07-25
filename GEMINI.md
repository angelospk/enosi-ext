# Enosi Extension Documentation

## 1. Project Overview

This browser extension is designed to enhance the user experience on the Greek government's OPEKEPE website (specifically the EAE 2024 portal). It injects a custom UI and provides a suite of tools to automate repetitive tasks, streamline data entry, and provide helpful information that is not readily available on the site.

The core functionalities include:
- **Automated Message Polling:** Regularly checks for system messages and errors for the current application and displays them in a dedicated, filterable UI.
- **In-Page Search:** Provides a powerful, context-aware search popup for various data types (crops, varieties, etc.) directly within input fields.
- **Advanced Data Operations:** Offers complex, multi-step actions triggered by keyboard shortcuts, such as:
    - Copying data (crops, eco-schemes, bio-status) between parcels.
    - Mass-updating land ownership details from a JSON input.
    - Finding unused land parcels by comparing AADE data with the current application.
    - Setting up a new application with pre-filled data via a "General Info Adder" utility.
- **Persistent UI:** A draggable and resizable popup provides access to all features without obstructing the main page content.
- **State Management:** A robust state management system ensures data is synchronized across the extension's different parts.

## 2. Core Concepts & Architecture

The extension is built using modern web technologies and follows a modular architecture to separate concerns.

- **Frontend Framework:** **Vue.js** is used to build all user-facing components, including the main popup, modals, and notifications.
- **State Management:** **Pinia** is used for centralized state management. This allows different parts of the extension (background script, content script, popups) to share and react to data changes in a consistent way. State is persisted in `browser.localStorage`.
- **Background & Content Scripts:** The extension is divided into two main parts:
    - **Background Script (`src/background`):** Acts as the central hub. It runs persistently in the background, managing the main state, handling all API communication with the OPEKEPE servers, listening for browser events (like tab changes), and performing heavy lifting like search indexing.
    - **Content Script (`src/content-script`):** Injected directly into the OPEKEPE web page. It is responsible for all UI/DOM manipulation, creating the Vue components, listening for user input (keyboard shortcuts, clicks), and communicating with the background script to request data or trigger actions.
- **Communication:** The `webext-bridge` library is used for seamless, typed communication between the background script, content scripts, and popup UIs.
- **Utilities (`src/utils`):** A set of helper modules that encapsulate complex business logic, such as interacting with the OPEKEPE API and performing multi-step data manipulation tasks (e.g., `general_info_adder.ts`, `mass_update_ownerships.ts`).

## 3. Key Functionalities

### Message Polling & Display
- **Polling:** The background script (`message-polling.ts`) periodically calls the `MainService/checkAee` API to fetch system messages for the currently viewed application ID.
- **State Management:** The `messages.store.ts` Pinia store manages the state of these messages, including new messages, removed messages, and user-dismissed messages (both for the session and permanently).
- **UI:** The `PersistentIconPopup.vue` component displays a badge with the number of new/changed messages. Inside the popup, the `MessagesDisplay.vue` component renders the list of messages, allowing for filtering and dismissal.

### In-Page Search
- **Backend:** The `search.store.ts` and `background/search.ts` work together to fetch, cache, and search through large datasets (crops, varieties, etc.) from the API. It maintains a "recent and popular" list to provide faster, more relevant results.
- **Frontend:** The `content-script/search.ts` detects when a user focuses on a searchable input field on the page. It then mounts the `SearchPopup.vue` component, which displays results fetched from the background script as the user types.

### Keyboard Shortcuts & Actions
- The `content-script/shortcuts.ts` file is the central point for handling all keyboard shortcuts.
- **Simple Shortcuts:** Navigate to different tabs/pages within the OPEKEPE site (e.g., `Ctrl+1` for General Info).
- **Complex Actions:** Trigger powerful utility functions.
    - `Ctrl+I` (`copyAgrotemaxioData`): Copies crop, cultivation, and eco-scheme data from a source parcel to multiple target parcels.
    - `Ctrl+M` (`handleMassUpdateFromJson`): A powerful tool that reads a JSON object to perform a full setup of an application's general information, including subsidies, documents, and contracts.
    - `Ctrl+E` (`handleOwnershipRefresh`): Mass updates, creates, or deletes ownership records from a JSON input.
    - `Ctrl+Q` (`findUnusedParcels`): Compares land parcels registered with AADE against those used in the current application and logs the unused ones in the console.

### Data Utilities (`src/utils`)
- **`api.ts`**: Provides a robust `fetchApi` wrapper for all communication with the OPEKEPE backend. It also contains the crucial `executeSync` function, which correctly batches changes and includes the main application header (`Edehd`) with an incremented `rowVersion` for optimistic locking, which is required by the backend for most update operations.
- **`general_info_adder.ts`**: Encapsulates the logic for the `Ctrl+M` shortcut. It's a complex, multi-step process that automates the setup of an entire application.
- **`mass_update_ownerships.ts` & `copy_owner.ts`**: Contain the logic for managing land ownership, which involves fetching existing data, processing user input, and creating batches of create/update/delete operations.

## 4. File & Folder Breakdown

- **`src/background`**: The core logic of the extension. Handles state, API calls, and browser events. The "brain" of the operation.
- **`src/content-script`**: Code that runs directly on the target website. Manages UI injection, user input, and communication with the background script.
- **`src/components`**: Reusable Vue.js components that form the user interface of the extension (popups, modals, data displays).
- **`src/stores`**: Pinia store definitions. Each file defines a "slice" of the application's shared state (e.g., messages, settings, search data). This is the single source of truth for the extension's data.
- **`src/utils`**: Helper functions and modules that contain complex, reusable business logic. This is where the most intricate data manipulation and API interaction logic resides.

## 5. Developer Guide: Interacting with the API

Direct database access is not possible. All data manipulation is performed by making `POST` requests to a backend REST API. The key to successfully updating data lies in understanding a critical concept: the **`Edetedeaeehd` entity** and its **`rowVersion`** property.

### The `Edetedeaeehd` and `rowVersion` (Critical Concept)

The OPEKEPE backend uses a form of **optimistic locking** to prevent data corruption from concurrent edits. Almost every significant write operation (creating, updating, or deleting data related to an application) requires you to send the main application header object, `Edetedeaeehd`, as part of the request.

-   **`Edetedeaeehd`**: This is the primary entity representing a single application. It contains top-level information and, most importantly, a `rowVersion` number.
-   **`rowVersion`**: This is an integer that the backend increments every time the application data is successfully modified.

When you want to save a change, you must:
1.  Fetch the *latest* version of the `Edetedeaeehd` entity to get the current `rowVersion`.
2.  Increment this `rowVersion` number by 1 (or sometimes 2, depending on the operation's complexity, but `executeSync` handles this).
3.  Send your desired changes *along with* the updated `Edetedeaeehd` object in a single batch request.

If the `rowVersion` you send is not the one the server expects (e.g., if another user or process has modified the data since you fetched it), the server will reject your entire request. This prevents you from accidentally overwriting other changes.

The utility functions in `src/utils/api.ts` are designed to handle this process for you automatically.

### Core Utility Functions in `src/utils/api.ts`

This file is the foundation for all backend communication.

1.  **`fetchApi(endpoint, body)`**:
    -   **Purpose**: The low-level function for all `POST` requests to the API.
    -   **Usage**: You provide the specific API endpoint (e.g., `Edetedeaeehd/findById`) and the JSON payload (`body`). It handles the request and returns the server's response. You should use this for all data *reading* operations.

2.  **`prepareEntityForRequest(entity)`**:
    -   **Purpose**: Cleans up a JavaScript object before it's sent to the API.
    -   **Details**: The backend API is strict about the format of the data it receives. This function removes any internal-only properties (like `$refId`, `$entityName`) and correctly formats special data types (like converting JavaScript `Date` objects to the ISO string format the server expects). You should pass any entity you plan to create or update through this function.

3.  **`synchronizeChanges(dataArray)`**:
    -   **Purpose**: Sends a *batch* of operations to the server. This is the core function for writing data.
    -   **`dataArray` Structure**: This is an array of "change" objects. Each object must have the following structure:
        ```typescript
        {
          status: 0, // 0 for Create, 1 for Update, 2 for Delete
          when: Date.now(), // Timestamp of the change
          entityName: "Edetedeaeeagroiem", // The name of the entity being changed
          entity: { ... } // The actual data object for the entity
        }
        ```

4.  **`executeSync(changes, mainApplicationId)`**:
    -   **Purpose**: This is the **high-level, recommended, and safest function for performing almost all write operations.**
    -   **How it Works**: It automates the critical `rowVersion` process. It takes your array of changes and:
        1.  Automatically fetches the latest `Edetedeaeehd` using the `mainApplicationId`.
        2.  Increments the `rowVersion`.
        3.  Adds the updated `Edetedeaeehd` object to your array of changes.
        4.  Calls `synchronizeChanges` with the complete batch.
    -   **Why you should use it**: It abstracts away the complexity of optimistic locking, making your code cleaner and ensuring your updates are much more likely to be accepted by the server.

---

### Step-by-Step Guide: Adding a New Update Feature

Let's say you want to add a new feature to update a specific piece of information.

**Step 1: Identify the API Endpoint and Data Structure**
-   Use your browser's developer tools (Network tab) on the OPEKEPE website.
-   Perform the action manually on the site and observe the `POST` request that is made.
-   Note the **Request URL**. The part after `/rest/` is your `endpoint`.
-   Examine the **request payload** (the JSON body sent with the request). This tells you the structure of the data you need to send.
-   Examine the **response payload** to see what the server returns.

**Step 2: Gather Necessary Data**
-   In your new function (e.g., in a file in `src/utils/`), use `fetchApi` to get the current state of the entities you need to modify. You will always need the `mainApplicationId`.

**Step 3: Prepare Your Array of Changes**
-   Create an array called `changes`.
-   For each item you want to create, update, or delete, create a "change" object as described above (`status`, `entityName`, `entity`).
-   Remember to pass your `entity` object through `prepareEntityForRequest` to clean it.

**Example: Preparing an update and a creation**
```typescript
import { fetchApi, prepareEntityForRequest, executeSync } from './api';

async function myNewUpdateFunction(appId: string, someDataToUpdate: any) {
  // Let's assume someDataToUpdate is an existing entity we fetched.
  const updatedEntity = {
    ...someDataToUpdate,
    someProperty: "new value"
  };

  const newEntity = {
    id: `TEMP_ID_${Date.now()}`, // A temporary ID for a new item
    // ... other properties for the new item
  };

  const changes = [
    {
      status: 1, // Update
      when: Date.now(),
      entityName: "SomeEntityName",
      entity: prepareEntityForRequest(updatedEntity)
    },
    {
      status: 0, // Create
      when: Date.now(),
      entityName: "AnotherEntityName",
      entity: prepareEntityForRequest(newEntity)
    }
  ];

  // Now, execute the changes.
  await executeSync(changes, appId);
}
```

**Step 4: Execute the Changes**
-   Call `await executeSync(changes, mainApplicationId);`.
-   This will handle the `Edehd` and `rowVersion` logic and send the batch to the server.
-   Add `try...catch` blocks to handle potential API errors gracefully.

**Step 5: Check for Special Cases**
-   While `executeSync` is the standard, some parts of the API might use a different synchronization endpoint (e.g., `synchronizeChangesWithDb_Edetedeaeedikaiol` for documents).
-   Look at existing code in `general_info_adder.ts` or `mass_update_ownerships.ts` to see if the entity you are working with requires a special endpoint. If it does, you may need to call `synchronizeChanges` directly and handle the `Edehd` update manually if required. However, this is rare. **When in doubt, start with `executeSync`.**
