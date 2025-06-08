// src/manifest.config.ts
import { env } from "node:process"
import type { ManifestV3Export } from "@crxjs/vite-plugin"
import packageJson from "./package.json" with { type: "json" }

const { version } = packageJson // name, description, displayName will be set from package.json by template
// Convert from Semver (example: 0.1.0-beta6)
const [major, minor, patch, label = "0"] = version
  // can only contain digits, dots, or dash
  .replace(/[^\d.-]+/g, "")
  // split into version parts
  .split(/[.-]/)

export default {
  author: {
    email: "angelos.papamichail@gmail.com", // Update with your email
  },
  name: "DNS Handler", // Or your desired extension name
  description: "Assists.",
  version: `${major}.${minor}.${patch}.${label}`,
  version_name: version,
  manifest_version: 3,
  action: {
    default_popup: "src/ui/action-popup/index.html", // Keep if you plan to have a browser action popup
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      all_frames: false, // Interaction is with the main page document
      js: ["src/content-script/index.ts"],
      matches: ["https://eae2024.opekepe.gov.gr/eae2024/*"], // Target specific pages
      run_at: "document_idle", // Run after DOM is mostly complete
      // css: ["src/content-script/index.css"], // If you have global styles for the injected UI
    },
  ],
  // side_panel: { // Keep or remove if not using side panel
  //   default_path: "src/ui/side-panel/index.html",
  // },
  // devtools_page: "src/devtools/index.html", // Keep or remove
  // options_page: "src/ui/options-page/index.html", // Keep or remove

  host_permissions: [
    "https://eae2024.opekepe.gov.gr/*" // Essential for fetch and script injection
  ],
  permissions: [
    "storage",      // If you need to store user preferences or cached data
    // "activeTab", // Generally useful, scripting might cover needs
    // "scripting", // If you need to programmatically execute scripts from background
    "tabs",     // If you need to interact with tabs
    "webNavigation", // If you need to interact with navigation
    // "background", // If background script has extensive tasks
    // "sidePanel", // If using side panel
  ],
  web_accessible_resources: [
    // If your Vue component or its assets (CSS, images) need to be loaded by the content script
    // and are part of the extension bundle, they might need to be listed here.
    // However, if the Vue component is bundled into content_script.ts and styles are scoped/inlined,
    // this might be minimal.
    // {
    //   resources: ["src/assets/some-image.png", "src/components/CommunityPopup.css"], // Example
    //   matches: ["https://eae2024.opekepe.gov.gr/*"],
    // },
    // These are from your template, keep them if you use these features
    {
      resources: [
        "src/assets/persistent-icon.png",
        "src/ui/setup/index.html",
        "src/ui/content-script-iframe/index.html",
        "src/ui/devtools-panel/index.html",
      ],
      matches: ["<all_urls>"], // Or restrict to target domain
      use_dynamic_url: false,
    },
  ],
  icons: {
    16: "src/assets/logo.png", // Make sure you have a logo.png or update path
    24: "src/assets/logo.png",
    32: "src/assets/logo.png",
    128: "src/assets/logo.png",
  },
} as ManifestV3Export