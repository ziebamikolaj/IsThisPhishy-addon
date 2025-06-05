// src/popup/popup-content.tsx
"use client";
import React from "react";
import { RefreshCw, Loader2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalysisData } from "./hooks/useAnalysisData";
import { Header, Footer } from "./components/Header";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { ScoreDisplay } from "./components/ScoreDisplay";
import { ScoreExplanationsList } from "./components/ScoreExplanations";

export const PopupContent = () => {
  const {
    storedData,
    currentUrl,
    currentDomain,
    isLoading,
    isRefreshing,
    trustScore,
    scoreExplanations,
    fetchData,
  } = useAnalysisData();

  const handleRefresh = () => {
    console.log("[Popup] Manual refresh triggered.");
    fetchData(true, true);
  };

  let content;
  const showInitialLoader =
    isLoading && !isRefreshing && !storedData?.analysis && !storedData?.error;
  const showErrorDisplay =
    storedData?.error &&
    (!trustScore || scoreExplanations.length === 0) &&
    !isRefreshing &&
    !isLoading;

  if (showInitialLoader) {
    content = <LoadingIndicator message="Inicjalizacja analizy..." />;
  } else if (showErrorDisplay) {
    content = (
      <ErrorDisplay
        error={storedData!.error!}
        onRetry={handleRefresh}
        isRetrying={isRefreshing}
      />
    );
  } else if (
    trustScore !== null ||
    scoreExplanations.length > 0 ||
    isRefreshing ||
    isLoading
  ) {
    content = (
      <>
        <ScoreDisplay
          score={trustScore}
          isLoading={isLoading || isRefreshing}
          errorOccurred={!!storedData?.error && !isLoading && !isRefreshing} // Pokaż błąd tylko jeśli nie ładujemy
          currentDomain={currentDomain}
          currentUrl={currentUrl}
        />
        <ScoreExplanationsList
          explanations={scoreExplanations}
          isLoading={isLoading || isRefreshing} // Przekaż oba stany
          errorOccurred={!!storedData?.error && !isLoading && !isRefreshing}
        />
        <Button
          onClick={handleRefresh}
          variant="secondary"
          size="sm"
          className="w-full mt-auto"
          disabled={isRefreshing || isLoading}
        >
          {isRefreshing || (isLoading && !trustScore && !storedData?.error) ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isRefreshing ? "Odświeżanie..." : "Odśwież (z analizą treści)"}
        </Button>
      </>
    );
  } else {
    content = (
      <div className="flex flex-col items-center justify-center h-full py-4">
        <Info className="mx-auto mb-2 h-10 w-10 text-blue-500" />
        <p className="mb-4 text-sm text-gray-600 text-center px-2">
          {!currentDomain
            ? "Otwórz stronę http/https, aby rozpocząć analizę."
            : "Kliknij, aby przeanalizować tę stronę."}
        </p>
        <Button
          onClick={handleRefresh}
          variant="default"
          size="sm"
          disabled={isRefreshing || isLoading || !currentDomain}
        >
          {isLoading || isRefreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Analizuj {currentDomain || ""}
        </Button>
      </div>
    );
  }

  return (
    <div className="w-96 rounded-md bg-white p-4 shadow-xl flex flex-col max-h-[580px] min-h-[450px]">
      <Header />
      <div className="flex-grow overflow-hidden flex flex-col">{content}</div>
      <Footer />
    </div>
  );
};
