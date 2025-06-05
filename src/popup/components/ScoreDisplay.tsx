// src/popup/components/ScoreDisplay.tsx
import React from "react";
import { Loader2 } from "lucide-react";

interface ScoreDisplayProps {
  score: number | null;
  isLoading: boolean; // Czy główny wynik jest ładowany
  errorOccurred?: boolean;
  currentDomain: string;
  currentUrl: string;
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  score,
  isLoading,
  errorOccurred,
  currentDomain,
  currentUrl,
}) => {
  const getScoreColorClasses = (
    s: number | null
  ): { bg: string; text: string; ring: string } => {
    if (s === null)
      return {
        bg: "bg-gray-400",
        text: "text-gray-700",
        ring: "ring-gray-400",
      };
    if (s < 40)
      return { bg: "bg-red-500", text: "text-white", ring: "ring-red-500" };
    if (s < 70)
      return {
        bg: "bg-yellow-500",
        text: "text-black",
        ring: "ring-yellow-500",
      };
    return { bg: "bg-green-500", text: "text-white", ring: "ring-green-500" };
  };

  const getScoreTextDescription = (
    s: number | null,
    loading: boolean,
    error: boolean | undefined
  ): string => {
    if (loading && s === null && !error) return "Analizowanie...";
    if (error && s === null) return "Błąd Oceny";
    if (s === null && !loading) return "Brak Oceny";
    if (s === null) return "Analizowanie..."; // Fallback
    if (s < 40) return "Wysokie Ryzyko";
    if (s < 70) return "Podwyższone Ryzyko";
    return "Niskie Ryzyko";
  };

  const colorClasses = getScoreColorClasses(score);
  const scoreText = getScoreTextDescription(score, isLoading, errorOccurred);

  return (
    <div className="mb-4 text-center">
      <div
        className={`mx-auto mb-3 h-20 w-20 rounded-full ring-4 ${colorClasses.ring} ${colorClasses.bg} flex items-center justify-center`}
      >
        <span className={`text-3xl font-bold ${colorClasses.text}`}>
          {isLoading && score === null && !errorOccurred ? (
            <Loader2 className="h-8 w-8 animate-spin" />
          ) : (
            score ?? "?"
          )}
        </span>
      </div>
      <p
        className={`text-lg font-semibold ${colorClasses.text
          .replace("text-white", "text-gray-800")
          .replace("text-black", "text-gray-800")
          .replace("text-gray-700", "text-gray-600")}`}
      >
        {" "}
        {/* Użyj ciemniejszego tekstu dla opisu */}
        {scoreText}
      </p>
      <p
        className="text-xs text-gray-500 mt-1 truncate px-2"
        title={currentUrl}
      >
        Analiza dla:{" "}
        <span className="font-medium">{currentDomain || "Bieżąca strona"}</span>
      </p>
    </div>
  );
};
