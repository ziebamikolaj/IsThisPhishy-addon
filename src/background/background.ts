import {
  DomainAnalysisDetails,
  PhishingTextAnalysis,
  PageContentAiAnalysis,
  StoredDomainData,
} from "@/types/domainAnalysis";
import { calculateTrustScore } from "@/popup/services/scoreCalculator";

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
  } catch (e) {
    console.warn("[BG] Failed to update badge.", e);
  }
};

const updateBadgeWithScore = (
  data: StoredDomainData,
  urlForAnalysis: string
) => {
  if (!data) return;
  const { score } = calculateTrustScore(data, urlForAnalysis);
  if (score !== null) {
    let color = "#10B981";
    if (score < 40) color = "#EF4444";
    else if (score < 70) color = "#F59E0B";
    updateBadge(score.toString(), color);
  } else if (data.error) {
    updateBadge("!", "#EF4444");
  } else {
    updateBadge("?", "#777777");
  }
};

const fetchTextAnalysis = async (
  textToAnalyze: string
): Promise<PhishingTextAnalysis | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/check_phishing_text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text_to_analyze: textToAnalyze }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.error("[BG] fetchTextAnalysis Network Error:", e);
    return null;
  }
};

export const performFullAnalysis = async (
  urlToAnalyze: string,
  contentChunksForAnalysis: string[] = []
): Promise<StoredDomainData> => {
  const domain = getDomainFromUrl(urlToAnalyze);
  if (!domain) return { error: "Invalid domain", lastChecked: Date.now() };

  updateBadge("...", "#F59E0B");

  try {
    const [domainDetailsResponse, urlTextAnalysisResult] = await Promise.all([
      fetch(`${API_BASE_URL}/analyze_domain_details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlToAnalyze }),
      }),
      fetchTextAnalysis(urlToAnalyze),
    ]);

    if (!domainDetailsResponse.ok) {
      return {
        error: "API Error (domain details)",
        lastChecked: Date.now(),
      };
    }
    const domainAnalysis: DomainAnalysisDetails =
      await domainDetailsResponse.json();

    console.log(domainAnalysis);
    if (domainAnalysis.error) {
      return { error: domainAnalysis.error, lastChecked: Date.now() };
    }

    let pageContentAiResults: PageContentAiAnalysis[] = [];
    if (contentChunksForAnalysis.length > 0) {
      const analysisPromises = contentChunksForAnalysis.map(
        async (chunk, idx) => {
          const result = await fetchTextAnalysis(chunk);
          if (result) {
            return {
              ...result,
              chunkIndex: idx,
              originalChunk: chunk.substring(0, 100) + "...",
            };
          }
          return null;
        }
      );
      pageContentAiResults = (await Promise.all(analysisPromises)).filter(
        (r) => r !== null
      ) as PageContentAiAnalysis[];
    }

    const storedData: StoredDomainData = {
      analysis: domainAnalysis,
      urlTextAnalysis: urlTextAnalysisResult,
      pageContentAnalyses: pageContentAiResults,
      lastChecked: Date.now(),
    };

    chrome.storage.local.set({ [domain]: storedData });
    updateBadgeWithScore(storedData, urlToAnalyze);
    return storedData;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    updateBadge("!", "#EF4444");
    return {
      error: `Network/Parsing error: ${errorMsg}`,
      lastChecked: Date.now(),
    };
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzePageContent") {
    console.log(`[BG] Received content for analysis from ${message.url}`);
    performFullAnalysis(message.url, message.contentChunks)
      .then((data) => {
        chrome.runtime
          .sendMessage({
            action: "analysisUpdated",
            domain: getDomainFromUrl(message.url),
            data,
            forUrl: message.url,
          })
          .catch(() => {});
        sendResponse({ success: true });
      })
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === "requestAnalysisForCurrentTab") {
    const urlToAnalyze = message.url;
    const tabId = message.tabId || sender.tab?.id;

    if (urlToAnalyze && tabId) {
      console.log(
        `[BG] Manual refresh requested for ${urlToAnalyze} on tab ${tabId}`
      );
      updateBadge("...", "#F59E0B");
      chrome.tabs.sendMessage(tabId, { action: "getTextContentFromPage" });
      sendResponse({ status: "refresh_triggered" });
    } else {
      sendResponse({ error: "No active tab/URL to refresh." });
    }
    return true;
  }

  return false;
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      const domain = getDomainFromUrl(tab.url);
      chrome.storage.local.get(domain, (result) => {
        const cachedData: StoredDomainData | undefined = result[domain];
        if (cachedData) {
          console.log(`[BG] onActivated: Found cached data for ${domain}`);
          updateBadgeWithScore(cachedData, tab.url!);
        } else {
          updateBadge("", "#777777");
        }
      });
    }
  });
});
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install" || details.reason === "update") {
    console.log(
      "[BG] Extension installed/updated. Injecting content scripts into existing tabs."
    );

    const tabs = await chrome.tabs.query({
      url: ["http://*/*", "https://*/*"],
      status: "complete",
    });

    for (const tab of tabs) {
      if (tab.id) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["src/content/content.js"],
          });
          console.log(`[BG] Injected content script into tab ${tab.id}`);
        } catch (err) {
          console.warn(`[BG] Failed to inject script into tab ${tab.id}:`, err);
        }
      }
    }
  }
});
import { runTests, runDownloadTest } from "./testRunner";
(globalThis as any).runExtensionTests = runTests;
(globalThis as any).runExtensionDownloadTest = runDownloadTest;

console.log("[BG] Background script loaded and listeners attached (v1.2.1).");
