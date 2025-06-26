// src/content/content.ts
import { Readability } from "@mozilla/readability";
import "../styles/globals.css";

const MAX_CHUNKS_FOR_ANALYSIS = 5;
const CHUNK_SIZE = 2000;

function extractAndSendContent() {
  // Use a clone of the document to avoid side-effects on the live page.
  const documentClone = document.cloneNode(true) as Document;
  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article || !article.textContent) {
    console.log(
      "[ContentScript] Readability found no content. Sending empty chunks."
    );
    // Still send a message so the background script knows content analysis was attempted but failed.
    chrome.runtime.sendMessage({
      action: "analyzePageContent",
      url: window.location.href,
      contentChunks: [],
    });
    return;
  }

  const cleanText = article.textContent.replace(/\s+/g, " ").trim();
  const chunks: string[] = [];
  if (cleanText.length > 0) {
    for (let i = 0; i < cleanText.length; i += CHUNK_SIZE) {
      chunks.push(cleanText.substring(i, i + CHUNK_SIZE));
    }
  }

  const finalChunks = chunks.slice(0, MAX_CHUNKS_FOR_ANALYSIS);
  console.log(
    `[ContentScript] Proactively sending ${finalChunks.length} chunks to background.`
  );

  chrome.runtime.sendMessage(
    {
      action: "analyzePageContent",
      url: window.location.href,
      contentChunks: finalChunks,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.warn(
          `[CS] Error sending content: ${chrome.runtime.lastError.message}`
        );
      } else if (response && !response.success) {
        console.warn(
          "[CS] Background failed to process content:",
          response.error
        );
      }
    }
  );
}

// This listener is now ONLY for handling manual refresh requests from the popup.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTextContentFromPage") {
    console.log("[ContentScript] Received manual refresh request.");
    extractAndSendContent();
    sendResponse({ status: "processing_initiated_by_manual_refresh" });
    return true;
  }
  return false;
});

// Proactively run the analysis when the script is injected and the page is ready.
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  // Small delay to ensure the page is fully settled.
  setTimeout(extractAndSendContent, 500);
} else {
  window.addEventListener(
    "load",
    () => {
      setTimeout(extractAndSendContent, 500);
    },
    { once: true }
  );
}

console.log("[ContentScript] IsThisPhishy v1.2.0 loaded (proactive mode).");
