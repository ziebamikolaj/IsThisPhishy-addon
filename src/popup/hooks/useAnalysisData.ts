// src/popup/hooks/useAnalysisData.ts
import { useState, useEffect, useCallback } from "react";
import { StoredDomainData } from "@/types/domainAnalysis";
import {
  calculateTrustScore,
  ScoreExplanation,
} from "../services/scoreCalculator";
import { getDomainFromUrl as getDomainFromUrlHelper } from "../utils/helpers";

export function useAnalysisData() {
  const [storedData, setStoredData] = useState<StoredDomainData | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [currentTabId, setCurrentTabId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [scoreExplanations, setScoreExplanations] = useState<
    ScoreExplanation[]
  >([]);

  const processData = useCallback(
    (data: StoredDomainData | null, urlForAnalysis: string) => {
      console.log(
        "[Hook] processData called with data for URL:",
        urlForAnalysis,
        data
      );
      setStoredData(data);
      if (data?.error && (!data.analysis || !data.urlTextAnalysis)) {
        console.warn("[Hook] Error in received data:", data.error);
        setTrustScore(null);
        setScoreExplanations([]);
      } else if (data?.analysis) {
        const { score, explanations } = calculateTrustScore(
          data,
          urlForAnalysis
        );
        setTrustScore(score);
        setScoreExplanations(explanations);
      } else {
        setTrustScore(null);
        setScoreExplanations([]);
      }
    },
    [] // This function is now fully stable
  );

  const fetchData = useCallback(
    (forceRefresh = false, forceContentFetch = false) => {
      if (!currentUrl) {
        console.warn("[Hook] fetchData: No currentUrl to analyze.");
        setIsLoading(false);
        setIsRefreshing(false);
        processData(
          { error: "Brak aktywnego URL.", lastChecked: Date.now() },
          ""
        );
        return;
      }

      console.log(
        `[Hook] fetchData triggered. forceRefresh: ${forceRefresh}, forceContent: ${forceContentFetch}, URL: ${currentUrl}`
      );

      if (forceRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      // The background script will handle the badge update.
      chrome.runtime.sendMessage(
        {
          action: "requestAnalysisForCurrentTab",
          forceContentRefresh: forceContentFetch || forceRefresh,
          forDomain: currentDomain,
          url: currentUrl,
          tabId: currentTabId,
        },
        (response) => {
          console.log(
            "[Hook] fetchData response from background:",
            response,
            "For URL:",
            currentUrl
          );
          let needsReset = true;

          if (chrome.runtime.lastError) {
            console.error(
              "[Hook] fetchData sendMessage error:",
              chrome.runtime.lastError.message
            );
            processData(
              { error: "Błąd komunikacji z tłem.", lastChecked: Date.now() },
              currentUrl
            );
          } else if (
            response?.status?.includes("triggered") ||
            response?.status?.includes("processing")
          ) {
            console.log(
              "[Hook] Background is processing, will wait for 'analysisUpdated'."
            );
            needsReset = false;
          } else if (response?.error) {
            processData(response as StoredDomainData, currentUrl);
          } else if (response) {
            processData(response as StoredDomainData, currentUrl);
          } else {
            processData(
              {
                error: "Nieoczekiwana odpowiedź od tła.",
                lastChecked: Date.now(),
              },
              currentUrl
            );
          }

          if (needsReset) {
            if (forceRefresh) setIsRefreshing(false);
            else setIsLoading(false);
          }
        }
      );
    },
    [currentUrl, currentDomain, processData, currentTabId]
  );

  useEffect(() => {
    console.log(
      "[Hook] Initializing: attaching listeners, getting active tab."
    );
    setIsLoading(true);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url && activeTab.url.startsWith("http")) {
        const newUrl = activeTab.url;
        const newDomain = getDomainFromUrlHelper(newUrl);
        console.log(
          `[Hook] Initial active tab: ${newUrl} (Domain: ${newDomain})`
        );
        setCurrentUrl(newUrl);
        setCurrentDomain(newDomain);
        setCurrentTabId(activeTab.id);
      } else {
        console.warn("[Hook] No valid active tab URL for initialization.");
        setCurrentUrl("");
        setCurrentDomain("");
        setCurrentTabId(activeTab.id);
        processData(
          {
            error: "Brak aktywnej strony http/https.",
            lastChecked: Date.now(),
          },
          ""
        );
        setIsLoading(false);
      }
    });
  }, [processData]);

  useEffect(() => {
    if (currentUrl && currentDomain && isLoading) {
      console.log(
        `[Hook] URL/Domain set (${currentUrl}). Checking cache or fetching.`
      );
      chrome.storage.local.get(currentDomain, (result) => {
        const cachedData: StoredDomainData | undefined = result[currentDomain];
        const fiveMinutes = 5 * 60 * 1000;
        if (
          cachedData?.analysis &&
          Date.now() - cachedData.lastChecked < fiveMinutes &&
          !cachedData.error
        ) {
          console.log(
            "[Hook] Using cached data for",
            currentDomain,
            cachedData
          );
          processData(cachedData, currentUrl);
          setIsLoading(false);
        } else {
          console.log(
            "[Hook] Cache miss or invalid for",
            currentDomain,
            ". Fetching fresh data with content."
          );
          fetchData(false, true);
        }
      });
    } else if (!currentUrl && isLoading) {
      setIsLoading(false);
      processData(
        {
          error: "Nie można ustalić adresu URL aktywnej karty.",
          lastChecked: Date.now(),
        },
        ""
      );
    }
  }, [currentUrl, currentDomain, isLoading, fetchData, processData]);

  useEffect(() => {
    console.log("[Hook] Attaching message listener.");
    const messageListener = (message: {
      action: string;
      domain?: string;
      data?: StoredDomainData;
    }) => {
      console.log("[Hook] Message received from background:", message);
      if (
        message.action === "analysisUpdated" &&
        message.data &&
        message.domain
      ) {
        if (message.domain === currentDomain) {
          console.log(
            "[Hook] 'analysisUpdated' for current domain:",
            message.domain,
            "Applying data."
          );
          processData(message.data, currentUrl);
          setIsLoading(false);
          setIsRefreshing(false);
        } else {
          console.log(
            `[Hook] 'analysisUpdated' for domain ${message.domain}, but current is ${currentDomain}. Ignoring.`
          );
        }
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      console.log("[Hook] Cleaning up message listener.");
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [currentDomain, currentUrl, processData]);

  return {
    storedData,
    currentUrl,
    currentDomain,
    isLoading,
    isRefreshing,
    trustScore,
    scoreExplanations,
    fetchData,
  };
}
