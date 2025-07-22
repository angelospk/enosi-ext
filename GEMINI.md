# Gemini Project Workspace

This file outlines the project structure and key functionalities of the Enosi Extension, a browser extension designed to enhance the user experience on the OPEKEPE website.

## Project Structure

The project is organized into the following main directories:

- **`src/`**: Contains the source code for the extension.
  - **`background/`**: Handles background tasks, such as message polling and event listening.
  - **`components/`**: Contains all Vue components used in the extension.
  - **`composables/`**: Contains reusable Vue composables.
  - **`content-script/`**: Contains the code that runs in the context of the OPEKEPE website.
  - **`stores/`**: Contains the Pinia stores for managing the extension's state.
  - **`types/`**: Contains the TypeScript type definitions.
  - **`utils/`**: Contains utility functions used throughout the extension.

## Key Functionalities

### 1. Message Polling

The extension periodically polls the OPEKEPE API for new messages and displays them to the user.

### 2. Last Year Data

The extension fetches and displays data from the previous year for the selected application.

### 3. Search

The extension provides a search functionality to quickly find information within the OPEKEPE website.

### 4. Shortcuts

The extension provides a set of keyboard shortcuts to quickly navigate the OPEKEPE website and perform common actions.

### 5. Mass Ownership Update

The extension provides a way to mass update ownerships by uploading a JSON file with the desired changes.

## JSON Format for Mass Ownership Update

The JSON file for the mass ownership update should be an array of objects, where each object represents a single ownership change. The following fields are supported:

- **`status`**: `0` for create, `1` for update, `2` for delete.
- **`kodikos_agrotemaxiou`**: The code of the parcel to update.
- **`afmidiokthth`**: The AFM of the owner.
- **`nameidiokthth`**: The name of the owner.
- **`synidiopercent`**: The ownership percentage.
- **`iemtype_kodikos`**: The ownership type code (e.g., "2020" for rented).
- **`atak`**: The ATK of the parcel.
- **`ektashAtak`**: The area of the parcel.
- **`aatemparastatiko`**: The document number. If set to `0`, the next available number will be used.
- **`dteenoikstart`**: The start date of the rental agreement.
- **`dteenoikend`**: The end date of the rental agreement.
- **`same`**: The field that stays the same if the ownership is updated, otherwise it can be null.
