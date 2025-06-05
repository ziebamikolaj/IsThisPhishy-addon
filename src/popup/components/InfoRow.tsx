// src/popup/components/InfoRow.tsx
import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScoreExplanation } from "../services/scoreCalculator"; // Załóżmy, że typ jest tam

interface InfoRowProps extends ScoreExplanation {
  isExpanded?: boolean;
  onToggle?: () => void;
}

export const InfoRow: React.FC<InfoRowProps> = ({
  icon: Icon,
  label,
  valueText,
  impact,
  details,
  longDesc,
  scoreEffect,
  isExpanded,
  onToggle,
}) => {
  const getIconColor = () => {
    switch (impact) {
      case "positive":
        return "text-green-500";
      case "negative":
        return "text-red-500";
      case "info":
        return "text-blue-500";
      default:
        return "text-gray-500";
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="mb-1 border-b border-gray-200 last:border-b-0 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex items-center justify-between text-sm cursor-pointer"
              onClick={longDesc && onToggle ? onToggle : undefined}
              onKeyDown={
                longDesc && onToggle
                  ? (e) => (e.key === "Enter" || e.key === " ") && onToggle()
                  : undefined
              }
              role={longDesc ? "button" : undefined}
              tabIndex={longDesc ? 0 : undefined}
              aria-expanded={longDesc ? isExpanded : undefined}
              aria-controls={
                longDesc
                  ? `desc-${label.replace(/\s+/g, "-").toLowerCase()}`
                  : undefined
              }
            >
              <div className="flex items-center min-w-0">
                {" "}
                {/* min-w-0 dla truncate */}
                <Icon className={`mr-2 h-5 w-5 shrink-0 ${getIconColor()}`} />
                <span className="font-medium truncate" title={label}>
                  {label}:
                </span>{" "}
                {/* truncate */}
              </div>
              <div className="flex items-center ml-2 shrink-0">
                {" "}
                {/* shrink-0 zapobiega rozpychaniu */}
                <span className="text-right break-words">{valueText}</span>{" "}
                {/* break-words dla długich wartości */}
                {longDesc &&
                  (isExpanded ? (
                    <ChevronUp className="ml-1 h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="ml-1 h-4 w-4 text-gray-500" />
                  ))}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            className="max-w-xs text-center bg-gray-800 text-white rounded-md p-2 shadow-lg"
          >
            <p>{details}</p>
            {scoreEffect && (
              <p className="text-xs italic mt-1">({scoreEffect})</p>
            )}
          </TooltipContent>
        </Tooltip>
        {longDesc && isExpanded && (
          <div
            id={`desc-${label.replace(/\s+/g, "-").toLowerCase()}`}
            className="mt-2 pl-7 text-xs text-gray-600 bg-gray-50 p-2 rounded prose prose-sm max-w-full overflow-x-auto"
          >
            {typeof longDesc === "string" ? <p>{longDesc}</p> : longDesc}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
