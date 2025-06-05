// src/popup/components/ScoreExplanations.tsx
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { InfoRow } from "./InfoRow"; // Zakładając, że jest w tym samym folderze
import { ScoreExplanation } from "../services/scoreCalculator";

interface ScoreExplanationsProps {
  explanations: ScoreExplanation[];
  isLoading: boolean; // Czy wskaźniki są ładowane
  errorOccurred?: boolean;
}

export const ScoreExplanationsList: React.FC<ScoreExplanationsProps> = ({
  explanations,
  isLoading,
  errorOccurred,
}) => {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const toggleRowExpansion = (id: string) =>
    setExpandedRow(expandedRow === id ? null : id);

  if (isLoading && explanations.length === 0 && !errorOccurred) {
    return (
      <div className="text-center py-4">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
        <p className="text-xs text-gray-500 mt-1">Ładowanie wskaźników...</p>
      </div>
    );
  }

  if (explanations.length === 0 && !isLoading && !errorOccurred) {
    return (
      <p className="text-xs text-gray-500 text-center py-4">
        Brak szczegółowych wskaźników do wyświetlenia.
      </p>
    );
  }
  if (explanations.length === 0 && errorOccurred) {
    return null; // Nie pokazuj nic, jeśli jest globalny błąd
  }

  return (
    <div className="mb-3 flex-grow overflow-y-auto pr-1 custom-scrollbar">
      {" "}
      {/* custom-scrollbar jeśli masz definicję */}
      <h3 className="text-sm font-semibold text-gray-700 mb-2 sticky top-0 bg-white py-1 z-10 border-b">
        Kluczowe Wskaźniki:
      </h3>
      {explanations.map((exp) => (
        <InfoRow
          key={exp.id}
          {...exp}
          isExpanded={expandedRow === exp.id}
          onToggle={() => toggleRowExpansion(exp.id)}
        />
      ))}
    </div>
  );
};
