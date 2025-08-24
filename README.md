# Enosi Extension 🇬🇷

[![Build Status](https://github.com/your-username/enosi-ext/workflows/Build/badge.svg)](https://github.com/your-username/enosi-ext/actions)

A browser extension to supercharge the experience on the Greek OPEKEPE (EAE 2024) portal. This tool is designed for farmers, advisors, and anyone who wrangles with the OPEKEPE website, aiming to automate repetitive tasks, streamline data entry, and make your life easier.

## ✨ Core Features

*   **🤖 Automated Message Polling:** Keeps an eye on system messages and errors for you, displaying them in a clean, filterable interface.
*   **🔍 In-Page Smart Search:** Instantly search for crops, varieties, and more directly from any input field. No more navigating away to find what you need.
*   **⚡️ Powerful Data Tools:** Use keyboard shortcuts to perform complex actions in seconds:
    *   Copy data (crops, eco-schemes, bio-status) between land parcels.
    *   Bulk-update land ownership details from a simple JSON file.
    *   Quickly find unused land parcels.
    *   Set up a new application with pre-filled data.
*   **📌 Persistent UI:** A handy, draggable popup gives you access to all features without getting in the way.
*   **🔄 Reliable State Management:** Ensures your data is always in sync across the extension.

## 🚀 Supercharged Shortcuts

Unleash the full power of the extension with these keyboard shortcuts:

| Shortcut      | Action                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `Ctrl + I`    | **Copy Parcel Data:** Copies crop, cultivation, and eco-scheme data from one parcel to others.     |
| `Ctrl + M`    | **Mass Info Update:** Sets up an application's general info (subsidies, documents, etc.) from JSON. |
| `Ctrl + E`    | **Ownership Refresh:** Mass updates, creates, or deletes ownership records from JSON.              |
| `Ctrl + Q`    | **Find Unused Parcels:** Finds and logs land parcels from AADE that aren't in the current application. |
| `Ctrl + 1..9` | **Quick Navigation:** Instantly jump to different tabs within the OPEKEPE application.             |

## 🔧 Tech Stack

This extension is built with modern web technologies:

*   **Frontend:** [Vue.js](https://vuejs.org/)
*   **State Management:** [Pinia](https://pinia.vuejs.org/)
*   **Browser APIs:** [WebExtensions](https://developer.mozilla.org/en-US/docs/Mozilla/Add-on_SDK/API/webextension)
*   **Communication:** `webext-bridge`

The extension consists of a background script for core logic and API communication, and a content script that injects the UI and new functionalities directly into the OPEKEPE website.

## 🤝 Contributing

Got an idea for a new feature or found a bug? We'd love your help! Please feel free to [open an issue](https://github.com/your-username/enosi-ext/issues) to start a discussion.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.