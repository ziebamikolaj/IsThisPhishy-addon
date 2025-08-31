// src/background/testRunner.ts

import { calculateTrustScore } from "../popup/services/scoreCalculator";
import { performFullAnalysis } from "./background";
import { StoredDomainData } from "@/types/domainAnalysis";

// --- URL Lists and Test Runner Setup (No Changes Here) ---
const URLS_TO_TEST = {
  "Grupa A (Phishing)": [
    "http://en-suites.pages.dev/",
    "https://linea-claim.com/",
    "http://backingarena.bet",
    "https://finance-ocean.org/",
    "https://fch715.icu/update/#/",
    "https://wlfilibertyfinances.xyz/",
    "https://www.bcmt-tech.com/",
    "https://www.caixaindeniza.sbs/",
    "https://serasabr.org/",
    "https://vncp-etax.com/",
    "https://confira-verificacao.com/inicio",
  ],
  "Grupa B (Legitimate)": [
    "https://www.mbank.pl/",
    "https://www.pkobp.pl/",
    "https://www.ing.pl/",
    "https://www.pekao.com.pl/",
    "https://www.aliorbank.pl/",
    "https://www.amazon.pl/",
    "https://allegro.pl/",
    "https://www.euro.com.pl/",
    "https://www.agatameble.pl/",
    "https://www.ikea.com/pl/pl/",
    "https://www.onet.pl/",
    "https://www.interia.pl/",
    "https://x.com/home",
    "https://tvn24.pl/",
    "https://wiadomosci.wp.pl/",
    "https://www.gov.pl/",
    "https://www.ue.katowice.pl/",
    "https://www.biznes.gov.pl/pl",
    "https://www.podatki.gov.pl/",
    "https://internet.gov.pl/",
  ],
  "Grupa C (Suspicious/Phishing)": [
    "https://parfumuri-top.ro/",
    "https://collab.land/",
    "https://allocation-maple.com/",
    "https://keeta-claim.com/",
    "https://lido-stake.app/",
    "https://radleyfinance.com/",
    "https://dqpazclw.shop/",
    "https://laborx.com",
    "https://rewards-blockstreet.com/",
    "https://plantaprolamsa.com/",
    "https://iowastep.org/",
  ],
};

// --- Helper Functions (No Changes Here) ---

function getTextFromUrl(url: string, timeout = 25000): Promise<string[]> {
  // ... (This function is unchanged)
  return new Promise(async (resolve, reject) => {
    let tabId: number | undefined = undefined;
    let timeoutId: NodeJS.Timeout | null = null;

    const listener = (message: any, sender: chrome.runtime.MessageSender) => {
      if (sender.tab?.id === tabId && message.action === "analyzePageContent") {
        console.log(`[TestRunner] Received content for ${url}`);
        cleanup();
        resolve(message.contentChunks || []);
      }
    };

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      chrome.runtime.onMessage.removeListener(listener);
      if (tabId) {
        chrome.tabs.remove(tabId).catch(() => {});
      }
    };

    timeoutId = setTimeout(() => {
      console.warn(`[TestRunner] Timeout waiting for content from ${url}`);
      cleanup();
      resolve([]);
    }, timeout);

    chrome.runtime.onMessage.addListener(listener);

    try {
      const tab = await chrome.tabs.create({ url, active: false });
      tabId = tab.id;
      if (!tabId) {
        throw new Error("Failed to create tab.");
      }
    } catch (error) {
      console.error(`[TestRunner] Failed to create tab for ${url}:`, error);
      cleanup();
      reject(error);
    }
  });
}

function formatResult(
  url: string,
  data: StoredDomainData,
  score: number | null,
  explanations: any[]
): string {
  // ... (This function is unchanged)
  let output = `URL: ${url}\n`;
  output += `FINAL SCORE: ${score ?? "N/A"}\n`;
  output += "----------------------------------------\n";

  if (data.error) {
    output += `Analysis Error: ${data.error}\n`;
  }

  explanations.forEach((exp) => {
    const value =
      typeof exp.valueText === "string" ? exp.valueText : "[UI Element]";
    output += `[${exp.impact.padEnd(8)}] ${exp.label.padEnd(
      20
    )} | Value: ${value.padEnd(25)} | Effect: ${exp.scoreEffect || "0 pkt"}\n`;
    output += `   Details: ${exp.details}\n\n`;
  });

  output += "========================================\n\n";
  return output;
}

export function runDownloadTest() {
  // ... (This function is unchanged)
  console.log("Running instant download test...");
  const testReport = `Download test initiated at: ${new Date().toISOString()}\n\nIf you see this, the download functionality is working.`;
  const dataUrl =
    "data:text/plain;charset=utf-8," + encodeURIComponent(testReport);
  chrome.downloads.download({
    url: dataUrl,
    filename: "IsThisPhishy-Download-Test.txt",
  });
}

// --- Main Test Runner (UPDATED) ---

export async function runTests() {
  console.log("Starting automated tests with FULL CONTENT ANALYSIS...");
  console.warn(
    "This will be slow and will open/close many tabs in the background."
  );

  let fullReport = `IsThisPhishy Automated Full Test Report - ${new Date().toISOString()}\n\n`;

  // <<< NEW: Object to store results for final summary >>>
  const resultsByGroup: Record<
    string,
    { url: string; score: number | null; explanations: any[] }[]
  > = {};

  for (const groupName in URLS_TO_TEST) {
    console.log(`--- Processing ${groupName} ---`);
    fullReport += `\n\n########## ${groupName} ##########\n\n`;
    const urls = URLS_TO_TEST[groupName as keyof typeof URLS_TO_TEST];

    // <<< NEW: Initialize array for the current group >>>
    resultsByGroup[groupName] = [];

    for (const url of urls) {
      try {
        console.log(`[TestRunner] Analyzing URL: ${url}`);
        const contentChunks = await getTextFromUrl(url);
        const data = await performFullAnalysis(url, contentChunks);
        const { score, explanations } = calculateTrustScore(data, url);

        // Add to detailed report
        fullReport += formatResult(url, data, score, explanations);

        // <<< NEW: Store the structured result for summary >>>
        resultsByGroup[groupName].push({ url, score, explanations });
      } catch (error) {
        console.error(`[TestRunner] Critical failure for URL ${url}:`, error);
        const errorMessage = `CRITICAL ERROR: ${(error as Error).message}`;
        fullReport += `URL: ${url}\n${errorMessage}\n========================================\n\n`;
        resultsByGroup[groupName].push({
          url,
          score: null,
          explanations: [{ details: errorMessage }],
        });
      }
    }
  }

  console.log("--- All tests complete! Generating summary... ---");

  // <<< NEW: Generate Summary and CSV Sections >>>

  let summaryReport = "\n\n\n";
  summaryReport += "###################################\n";
  summaryReport += "###        TEST SUMMARY         ###\n";
  summaryReport += "###################################\n\n";

  // --- Average Scores Section ---
  summaryReport += "--- Average Scores by Group ---\n";
  for (const groupName in resultsByGroup) {
    const results = resultsByGroup[groupName];
    const validScores = results
      .map((r) => r.score)
      .filter((s) => s !== null) as number[];

    if (validScores.length > 0) {
      const average =
        validScores.reduce((a, b) => a + b, 0) / validScores.length;
      summaryReport += `${groupName.padEnd(30)}: ${average.toFixed(2)}\n`;
    } else {
      summaryReport += `${groupName.padEnd(30)}: N/A (no valid scores)\n`;
    }
  }

  // --- Full CSV Data Section ---
  summaryReport += "\n\n--- CSV Data for Charting (URL | Score | Group) ---\n";
  summaryReport += "URL|Score|Group\n";
  for (const groupName in resultsByGroup) {
    resultsByGroup[groupName].forEach((result) => {
      summaryReport += `${result.url}|${
        result.score ?? "ERROR"
      }|${groupName}\n`;
    });
  }

  // --- Advanced CSV Data Section (for detailed analysis) ---
  summaryReport += "\n\n--- Advanced CSV Data for Detailed Analysis ---\n";
  // Create a header row with all possible explanation labels
  const allExplanationLabels = new Set<string>(["URL", "Final_Score", "Group"]);
  Object.values(resultsByGroup)
    .flat()
    .forEach((result) => {
      result.explanations.forEach((exp) =>
        allExplanationLabels.add(exp.label.replace(/\s+/g, "_"))
      );
    });
  const headerRow = Array.from(allExplanationLabels).join("|");
  summaryReport += headerRow + "\n";

  // Create a data row for each URL
  for (const groupName in resultsByGroup) {
    resultsByGroup[groupName].forEach((result) => {
      const dataRow: Record<string, string | number | null> = {
        URL: result.url,
        Final_Score: result.score ?? "ERROR",
        Group: groupName,
      };
      // Populate scores for each explanation
      result.explanations.forEach((exp) => {
        const labelKey = exp.label.replace(/\s+/g, "_");
        // Extract the numerical value from the scoreEffect string (e.g., "-10 pkt" -> -10)
        const scoreValue = exp.scoreEffect
          ? parseInt(exp.scoreEffect.replace(" pkt", "").replace("+", ""))
          : 0;
        dataRow[labelKey] = isNaN(scoreValue) ? 0 : scoreValue;
      });
      // Build the final CSV row string
      const rowString = Array.from(allExplanationLabels)
        .map((label) => dataRow[label] ?? 0)
        .join("|");
      summaryReport += rowString + "\n";
    });
  }

  // Append the summary to the main report
  fullReport += summaryReport;

  // --- Download Section (Unchanged) ---
  const dataUrl =
    "data:text/plain;charset=utf-8," + encodeURIComponent(fullReport);
  chrome.downloads.download({
    url: dataUrl,
    filename: "IsThisPhishy-Full-Test-Report.txt",
  });
}
