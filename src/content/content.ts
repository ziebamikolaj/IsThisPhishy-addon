import "../styles/globals.css";

const MAX_TEXT_CHUNKS = 5;
const MIN_CHUNK_LENGTH = 100;
const TARGET_CHUNK_LENGTH = 300;

function isVisible(element: HTMLElement | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    element.offsetParent !== null &&
    rect.width > 0 &&
    rect.height > 0 &&
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}

function extractVisibleTextChunks(): string[] {
  const chunks: string[] = [];
  let currentChunk = "";
  const BANNED_TAGS = [
    "script",
    "style",
    "noscript",
    "iframe",
    "canvas",
    "svg",
    "path",
    "head",
    "meta",
    "link",
  ];
  // const LOW_PRIORITY_TAGS = ['button', 'a', 'nav', 'footer', 'header', 'figcaption', 'aside', 'details', 'summary']; // Zakomentowane, bo nieużywane

  function traverseNodes(node: Node, depth = 0) {
    if (chunks.length >= MAX_TEXT_CHUNKS * 2 || depth > 20) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const parentElement = node.parentNode as HTMLElement;
      if (parentElement && isVisible(parentElement)) {
        const text = node.nodeValue?.replace(/\s+/g, " ").trim();
        if (text && text.length > 5) {
          const tagName = parentElement.tagName.toLowerCase();
          if (BANNED_TAGS.includes(tagName)) return;

          currentChunk += text + " ";
          if (currentChunk.length >= TARGET_CHUNK_LENGTH) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
            if (chunks.length >= MAX_TEXT_CHUNKS * 2) return;
          }
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      if (BANNED_TAGS.includes(tagName)) return;

      if (isVisible(element)) {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverseNodes(node.childNodes[i], depth + 1);
          if (chunks.length >= MAX_TEXT_CHUNKS * 2) return;
        }
      }
    }
  }

  if (document.body) traverseNodes(document.body);

  if (currentChunk.trim().length >= MIN_CHUNK_LENGTH)
    chunks.push(currentChunk.trim());

  // console.log("[ContentScript] Raw chunks extracted:", chunks.length); // Możesz odkomentować do debugowania
  const filteredChunks = chunks
    .filter((chunk) => chunk.length >= MIN_CHUNK_LENGTH)
    .map((chunk) => chunk.substring(0, TARGET_CHUNK_LENGTH * 2))
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_TEXT_CHUNKS);
  // console.log("[ContentScript] Filtered chunks for analysis:", filteredChunks.length); // Możesz odkomentować
  return filteredChunks;
}

function sendTextToBackground() {
  const textChunks = extractVisibleTextChunks();
  if (
    document.body.innerText.trim().length < MIN_CHUNK_LENGTH &&
    textChunks.length === 0
  ) {
    console.log(
      "[ContentScript] Page content too short or no significant text chunks found."
    );
    chrome.runtime.sendMessage({
      action: "analyzePageContent",
      url: window.location.href,
      contentChunks: [],
    });
    return;
  }

  console.log(
    `[ContentScript] Sending ${textChunks.length} text chunks to background.`
  );
  chrome.runtime.sendMessage(
    {
      action: "analyzePageContent",
      url: window.location.href,
      contentChunks: textChunks,
    },
    (response) => {
      if (chrome.runtime.lastError)
        console.warn(
          "[CS] Error sending content:",
          chrome.runtime.lastError.message
        );
      else if (response && !response.success)
        console.warn("[CS] BG failed to process content:", response.error);
    }
  );
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTextContentFromPage") {
    console.log("[ContentScript] Received getTextContentFromPage request.");
    requestAnimationFrame(() => {
      setTimeout(() => {
        try {
          sendTextToBackground();
          sendResponse({ status: "processing_initiated_by_content" });
        } catch (e) {
          console.error(
            "[ContentScript] Error in sendTextToBackground/sendResponse:",
            e
          );
          sendResponse({
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }, 50);
    });
    return true;
  }
  return false;
});

console.log("[ContentScript] IsThisPhishy content script v1.0.3 loaded.");
