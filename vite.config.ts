import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import webExtension from "vite-plugin-web-extension";
import path from "node:path";

function generateManifest() {
  return {
    manifest_version: 3,
    name: "IsThisFishy Extension (Dev)",
    version: "1.0.3",
    description: "A browser extension to detect fishy content - DEV MODE",
    action: {
      default_popup: "src/popup/index.html",
    },
    background: {
      service_worker: "src/background/background.ts",
      type: "module",
    },
    content_scripts: [
      {
        matches: ["<all_urls>"],
        js: ["src/content/content.ts"],
      },
    ],
    icons: {
      "16": "icon.png",
      "48": "icon.png",
      "128": "icon.png",
    },
    permissions: ["activeTab", "storage", "tabs", "scripting"],
    host_permissions: ["<all_urls>"],
  };
}

export default defineConfig(({ mode }) => {
  const isDevelopment = mode === "development";
  return {
    plugins: [
      react(),
      webExtension({
        manifest: generateManifest,
        // verbose: true, // Odkomentuj dla debugowania problemów z pluginem
      }),
    ],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    build: {
      outDir: path.resolve(__dirname, "dist"),
      sourcemap: isDevelopment ? "inline" : false,
      emptyOutDir: true,
    },
    server: { hmr: { protocol: "ws", host: "localhost", port: 5174 } }, // Zmieniono port na domyślny Vite, jeśli nie używasz 5000 specjalnie
  };
});
