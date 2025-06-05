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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [scoreExplanations, setScoreExplanations] = useState<
    ScoreExplanation[]
  >([]);

  const updateBadge = useCallback(
    (score: number | null, error?: string | null, loading?: boolean): void => {
      let text = "",
        color = "#777777";
      if (loading) {
        text = "...";
        color = "#F59E0B";
      } else if (error) {
        text = "!";
        color = "#EF4444";
      } else if (score !== null) {
        text = score.toString();
        if (score < 40) color = "#EF4444";
        else if (score < 70) color = "#F59E0B";
        else color = "#10B981";
      }
      try {
        chrome.runtime.sendMessage(
          { action: "updateExtensionBadge", text, color },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn(
                "[Hook] Badge update sendMessage error:",
                chrome.runtime.lastError.message
              );
            } else if (response && !response.success) {
              console.warn("[Hook] Background failed to update badge.");
            }
          }
        );
      } catch (e) {
        console.warn("[Hook] Error trying to send badge update message:", e);
      }
    },
    []
  );

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
        updateBadge(null, data.error, false);
      } else if (data?.analysis) {
        const { score, explanations } = calculateTrustScore(
          data,
          urlForAnalysis
        );
        setTrustScore(score);
        setScoreExplanations(explanations);
        updateBadge(score, data.error, false); // Przekaż błąd, jeśli istnieje, nawet z częściowymi danymi
      } else {
        setTrustScore(null);
        setScoreExplanations([]);
        updateBadge(null, null, isLoading || isRefreshing);
      }
    },
    [updateBadge, isLoading, isRefreshing]
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
      updateBadge(null, null, true);

      chrome.runtime.sendMessage(
        {
          action: "requestAnalysisForCurrentTab",
          forceContentRefresh: forceContentFetch || forceRefresh,
          forDomain: currentDomain,
          url: currentUrl,
        },
        (response) => {
          console.log(
            "[Hook] fetchData response from background:",
            response,
            "For URL:",
            currentUrl
          );
          let needsReset = true; // Czy resetować flagi ładowania

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
            needsReset = false; // Nie resetuj, czekamy na inną wiadomość
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
    [currentUrl, currentDomain, processData, updateBadge]
  );

  useEffect(() => {
    console.log(
      "[Hook] Initializing: attaching listeners, getting active tab."
    );
    setIsLoading(true);
    updateBadge(null, null, true);

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
      } else {
        console.warn("[Hook] No valid active tab URL for initialization.");
        setCurrentUrl("");
        setCurrentDomain("");
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
  }, [processData, updateBadge]); // Uruchom tylko raz przy montażu hooka

  useEffect(() => {
    if (currentUrl && currentDomain && isLoading) {
      // Dopiero gdy URL jest ustawiony i jesteśmy w stanie isLoading
      console.log(
        `[Hook] URL/Domain set (${currentUrl}). Checking cache or fetching.`
      );
      chrome.storage.local.get(currentDomain, (result) => {
        const cachedData: StoredDomainData | undefined = result[currentDomain];
        const fiveMinutes = 5 * 60 * 1000;
        if (
          cachedData?.analysis && // Upewnij się, że kluczowe dane są w cache
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
      // Jeśli URL się nie ustawił, a nadal ładujemy
      setIsLoading(false); // Zakończ ładowanie, bo nie ma co analizować
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
