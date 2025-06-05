// src/popup/components/ErrorDisplay.tsx
import React from "react";
import { FileWarning, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorDisplayProps {
  error: string;
  onRetry: () => void;
  isRetrying: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  isRetrying,
}) => (
  <div className="flex flex-col items-center justify-center h-full py-4">
    <FileWarning className="mb-2 h-10 w-10 text-red-500" />
    <p className="mb-1 text-base font-semibold text-gray-800">Błąd Analizy</p>
    <p className="mb-4 text-xs text-gray-600 px-2 text-center">{error}</p>
    <Button onClick={onRetry} variant="outline" size="sm" disabled={isRetrying}>
      {isRetrying ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Spróbuj Ponownie
    </Button>
  </div>
);
