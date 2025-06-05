// src/background/background.ts
import {
  DomainAnalysisDetails,
  PhishingTextAnalysis,
  PageContentAiAnalysis,
  StoredDomainData,
} from "@/types/domainAnalysis";

const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const getDomainFromUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const updateBadge = (text: string, color: string = "#777777") => {
  try {
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color });
    console.log(`[BG] Badge updated: text="${text}", color="${color}"`);
  } catch (e) {
    console.warn(
      "[BG] Failed to update badge, extension context likely invalid.",
      e
    );
  }
};

const fetchTextAnalysis = async (
  textToAnalyze: string
): Promise<PhishingTextAnalysis | null> => {
  const textSnippet =
    textToAnalyze.substring(0, 100) + (textToAnalyze.length > 100 ? "..." : "");
  console.log(
    `[BG] fetchTextAnalysis: Attempting to analyze text snippet: "${textSnippet}"`
  );
  try {
    const response = await fetch(`${API_BASE_URL}/check_phishing_text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text_to_analyze: textToAnalyze }),
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "No error body");
      console.error(
        `[BG] fetchTextAnalysis API Error for snippet "${textSnippet}": ${response.status}`,
        errorBody
      );
      return null;
    }
    const data: PhishingTextAnalysis = await response.json();
    console.log(
      `[BG] fetchTextAnalysis API Success for snippet "${textSnippet}":`,
      data
    );
    return data;
  } catch (e) {
    console.error(
      `[BG] fetchTextAnalysis Network Error for snippet "${textSnippet}":`,
      e
    );
    return null;
  }
};

const performFullAnalysis = async (
  urlToAnalyze: string,
  contentChunksForAnalysis?: string[] // Zmieniona nazwa dla jasności, to są chunki tekstu
): Promise<StoredDomainData> => {
  const domain = getDomainFromUrl(urlToAnalyze);
  if (!domain) {
    console.warn(
      "[BG] performFullAnalysis: Invalid domain from URL:",
      urlToAnalyze
    );
    return { error: "Invalid domain", lastChecked: Date.now() };
  }
  updateBadge("...", "#F59E0B");
  console.log(
    `[BG] Performing full analysis for ${urlToAnalyze}. Content chunks for analysis: ${
      contentChunksForAnalysis?.length || 0
    }`
  );

  try {
    const [domainDetailsResponse, urlTextAnalysisResult] = await Promise.all([
      fetch(`${API_BASE_URL}/analyze_domain_details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToAnalyze }),
      }),
      fetchTextAnalysis(urlToAnalyze),
    ]);

    console.log(
      `[BG] performFullAnalysis - URL AI Analysis result for ${urlToAnalyze}:`,
      urlTextAnalysisResult
    );

    if (!domainDetailsResponse.ok) {
      const errorData = await domainDetailsResponse
        .json()
        .catch(() => ({ detail: "Unknown API error (domain)" }));
      updateBadge("!", "#EF4444");
      console.error(`[BG] Domain analysis API Error for ${domain}:`, errorData);
      return {
        error: `API Error (domain):${
          errorData.detail || domainDetailsResponse.statusText
        }`,
        lastChecked: Date.now(),
      };
    }
    const domainAnalysis: DomainAnalysisDetails =
      await domainDetailsResponse.json();
    if (domainAnalysis.error) {
      updateBadge("?", "#EF4444");
      console.warn(
        `[BG] API returned error in domain data for ${domain}:`,
        domainAnalysis.error
      );
      return { error: domainAnalysis.error, lastChecked: Date.now() };
    }
    console.log("[BG] Domain analysis OK for", domain);

    let pageContentAiResults: PageContentAiAnalysis[] = [];
    if (contentChunksForAnalysis && contentChunksForAnalysis.length > 0) {
      console.log(
        `[BG] Analyzing ${contentChunksForAnalysis.length} content chunks for ${domain}`
      );
      const analysisPromises = contentChunksForAnalysis.map(
        async (chunk, idx) => {
          const result = await fetchTextAnalysis(chunk);
          if (result) {
            return {
              ...result,
              chunkIndex: idx,
              originalChunk: chunk.substring(0, 100) + "...",
            };
          } else {
            console.warn(
              `[BG] Failed to analyze content chunk ${idx} for ${domain}`
            );
            return null;
          }
        }
      );
      const results = await Promise.all(analysisPromises);
      pageContentAiResults = results.filter(
        (r) => r !== null
      ) as PageContentAiAnalysis[];
      console.log(
        `[BG] pageContentAiResults for ${domain} (count: ${pageContentAiResults.length}):`,
        pageContentAiResults
      );
    } else {
      console.log(`[BG] No content chunks provided to analyze for ${domain}`);
    }

    const storedData: StoredDomainData = {
      analysis: domainAnalysis,
      urlTextAnalysis: urlTextAnalysisResult,
      pageContentAnalyses: pageContentAiResults, // Zawsze tablica
      lastChecked: Date.now(),
    };
    console.log(
      "[BG] StoredData to be saved for",
      domain,
      ":",
      JSON.parse(JSON.stringify(storedData)) // Głęboka kopia dla logowania
    );
    chrome.storage.local.set({ [domain]: storedData });
    return storedData;
  } catch (e) {
    updateBadge("!", "#EF4444");
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(
      `[BG] Network/Parsing Error in performFullAnalysis for ${domain}: ${errorMsg}`
    );
    return {
      error: `Network/Parsing error: ${errorMsg}`,
      lastChecked: Date.now(),
    };
  }
};

const triggerAnalysisForUrl = async (
  url: string,
  forceContentFetch: boolean = false,
  tabIdForContent?: number
) => {
  const domain = getDomainFromUrl(url);
  if (!domain) {
    console.warn("[BG] triggerAnalysis: No domain for URL", url);
    return;
  }

  console.log(
    `[BG] triggerAnalysisForUrl: ${url}, forceContentFetch: ${forceContentFetch}, tabIdForContent: ${tabIdForContent}`
  );

  if (forceContentFetch && tabIdForContent) {
    console.log(
      "[BG] Requesting text from page:",
      url,
      "Tab ID:",
      tabIdForContent
    );
    chrome.tabs.sendMessage(
      tabIdForContent,
      { action: "getTextContentFromPage" },
      (responseFromContent) => {
        // Ta odpowiedź jest z content.ts
        if (chrome.runtime.lastError) {
          console.warn(
            `[BG] Error sending to content script for ${url} (tab ${tabIdForContent}): ${chrome.runtime.lastError.message}. Proceeding with URL-only analysis (no new content chunks).`
          );
          // Nie przekazujemy starych chunków, tylko puste, bo content script nie odpowiedział
          performFullAnalysis(url, []).then((data) => {
            chrome.runtime
              .sendMessage({
                action: "analysisUpdated",
                domain,
                data,
                forUrl: url,
              })
              .catch((e) =>
                console.warn(
                  "[BG] Error sending analysisUpdated (no content fetch response):",
                  e.message
                )
              );
          });
        } else if (responseFromContent?.status?.includes("processing")) {
          console.log("[BG] Content script started processing text for:", url);
          // Czekamy, aż content script wyśle 'analyzePageContent' z CHUNKAMI TEKSTU
        } else {
          console.warn(
            "[BG] Content script for",
            url,
            "responded unexpectedly or failed to start:",
            responseFromContent,
            ". Proceeding with URL-only analysis (no new content chunks)."
          );
          performFullAnalysis(url, []).then((data) => {
            chrome.runtime
              .sendMessage({
                action: "analysisUpdated",
                domain,
                data,
                forUrl: url,
              })
              .catch((e) =>
                console.warn(
                  "[BG] Error sending analysisUpdated (unexpected content response):",
                  e.message
                )
              );
          });
        }
      }
    );
  } else {
    // Nie wymuszamy pobierania treści z content.ts (forceContentFetch === false)
    console.log(
      `[BG] Performing analysis for ${domain} (no force content fetch). Will check cache or do URL/Domain analysis only.`
    );
    chrome.storage.local.get(domain, (result) => {
      const cachedData: StoredDomainData | undefined = result[domain];
      const fiveMinutes = 5 * 60 * 1000;
      if (
        cachedData?.analysis &&
        Date.now() - cachedData.lastChecked < fiveMinutes &&
        typeof cachedData.urlTextAnalysis !== "undefined" &&
        Array.isArray(cachedData.pageContentAnalyses) && // pageContentAnalyses z cache (mogą być puste)
        !cachedData.error
      ) {
        console.log(
          "[BG] Using fully cached data (including potentially empty pageContentAnalyses):",
          domain
        );
        chrome.runtime
          .sendMessage({
            action: "analysisUpdated",
            domain,
            data: cachedData,
            forUrl: url,
          })
          .catch((e) =>
            console.warn(
              "[BG] Error sending analysisUpdated (cache):",
              e.message
            )
          );
      } else {
        console.log(
          "[BG] Cache miss, incomplete, or error. Performing analysis. NO NEW CONTENT CHUNKS WILL BE FETCHED.",
          url
        );
        // Wykonujemy analizę, ale nie próbujemy pobierać nowych chunków treści.
        // Jeśli cachedData.pageContentAnalyses istnieje, to znaczy, że kiedyś je pobraliśmy,
        // ale teraz cache jest nieaktualny. Dla uproszczenia, nie będziemy ich tu ponownie używać,
        // chyba że logika scoreCalculator jest na to gotowa. Bezpieczniej jest przekazać puste.
        performFullAnalysis(url, []).then(
          // Zawsze puste, jeśli nie ma forceContentFetch
          (data) => {
            chrome.runtime
              .sendMessage({
                action: "analysisUpdated",
                domain,
                data,
                forUrl: url,
              })
              .catch((e) =>
                console.warn(
                  "[BG] Error sending analysisUpdated (no cache/no force):",
                  e.message
                )
              );
          }
        );
      }
    });
  }
};

// ... (reszta handleTabUpdate i listenerów pozostaje taka sama) ...
const handleTabUpdate = async (url: string | undefined, tabId?: number) => {
  if (url && (url.startsWith("http:") || url.startsWith("https:"))) {
    console.log(`[BG] handleTabUpdate for URL: ${url}, TabID: ${tabId}`);
    triggerAnalysisForUrl(url, false, tabId);
  } else {
    console.log(
      `[BG] handleTabUpdate: Skipped (not http/https or no URL): ${url}`
    );
    updateBadge("", "#777777");
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active && tab.url) {
    console.log(
      `[BG] onUpdated: complete & active for tab ${tabId}, url: ${tab.url}`
    );
    handleTabUpdate(tab.url, tabId);
  }
});
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      console.log(`[BG] onActivated: tab ${activeInfo.tabId}, url: ${tab.url}`);
      handleTabUpdate(tab.url, activeInfo.tabId);
    }
  });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      console.log(
        `[BG] onStartup: active tab ${tabs[0].id}, url: ${tabs[0].url}`
      );
      handleTabUpdate(tabs[0].url, tabs[0].id);
    }
  });
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs[0]?.url) {
        console.log(
          `[BG] onFocusChanged: window ${windowId}, active tab ${tabs[0].id}, url: ${tabs[0].url}`
        );
        handleTabUpdate(tabs[0].url, tabs[0].id);
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[BG] Received message:", message, "From sender:", sender);
  if (message.action === "requestAnalysisForCurrentTab") {
    const tabToUse = sender.tab || message.tab;
    const urlToAnalyze = tabToUse?.url || message.url;
    const tabIdForContent = tabToUse?.id;

    if (urlToAnalyze) {
      const domain = getDomainFromUrl(urlToAnalyze);
      if (domain) {
        console.log(
          `[BG] requestAnalysisForCurrentTab for ${domain} (URL: ${urlToAnalyze}). Force content: ${!!message.forceContentRefresh}. Tab for content: ${tabIdForContent}`
        );
        triggerAnalysisForUrl(
          urlToAnalyze,
          !!message.forceContentRefresh,
          tabIdForContent
        );
        sendResponse({ status: "analysis_triggered", lastChecked: Date.now() });
      } else {
        console.warn(
          "[BG] requestAnalysisForCurrentTab: No valid domain for URL:",
          urlToAnalyze
        );
        sendResponse({ error: "No valid domain.", lastChecked: Date.now() });
      }
    } else {
      console.warn(
        "[BG] requestAnalysisForCurrentTab: No URL provided or found in sender."
      );
      sendResponse({ error: "No active tab/URL.", lastChecked: Date.now() });
    }
    return true;
  }

  if (message.action === "analyzePageContent") {
    const { url, contentChunks } = message; // contentChunks to string[]
    if (!url) {
      console.error("[BG] analyzePageContent: URL missing in message.");
      sendResponse({ success: false, error: "URL missing." });
      return false; // Zwróć false, jeśli nie ma asynchronicznej operacji
    }
    const domain = getDomainFromUrl(url);
    console.log(
      `[BG] Received ${
        contentChunks?.length || 0
      } content chunks from content script for URL:`,
      url
    );
    performFullAnalysis(url, contentChunks) // Przekaż contentChunks tutaj
      .then((data) => {
        console.log(
          `[BG] Analysis complete (after content chunks received) for ${domain}. Sending update.`
        );
        chrome.runtime
          .sendMessage({ action: "analysisUpdated", domain, data, forUrl: url })
          .catch((e) =>
            console.warn(
              "[BG] Error sending analysisUpdated (analyzePageContent):",
              e.message
            )
          );
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error(
          "[BG] Error in performFullAnalysis (from analyzePageContent):",
          error
        );
        sendResponse({ success: false, error: error.message });
      });
    return true; // Ważne dla asynchronicznego sendResponse
  }

  if (message.action === "updateExtensionBadge") {
    if (message.text !== undefined && message.color !== undefined) {
      updateBadge(message.text, message.color);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "Missing text/color for badge." });
    }
    // Ta odpowiedź może być synchroniczna, więc return true nie jest tu krytyczne, ale nie zaszkodzi.
    return true;
  }
  console.log(
    "[BG] Message action not recognized or not handled:",
    message.action
  );
  return false; // Zwróć false dla nieobsługiwanych akcji lub jeśli odpowiedź jest synchroniczna
});

console.log("[BG] Background script loaded and listeners attached (v1.0.5).");
