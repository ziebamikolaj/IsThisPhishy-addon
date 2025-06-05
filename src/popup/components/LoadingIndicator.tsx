// src/popup/components/LoadingIndicator.tsx
import React from "react";
import { Loader2 } from "lucide-react";

interface LoadingIndicatorProps {
  message?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = "Ładowanie danych...",
}) => (
  <div className="flex flex-col items-center justify-center h-full py-8">
    <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
    <p className="text-sm text-gray-600">{message}</p>
  </div>
);
