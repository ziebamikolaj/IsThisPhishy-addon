// src/popup/utils/helpers.ts
export const formatDomainAge = (days: number | null | undefined): string => {
  if (days === null || typeof days === "undefined") return "N/A";
  if (days < 0) return "Data przyszła (podejrzane)";
  if (days < 30) return `${days} dni (bardzo młoda)`;
  if (days < 180) return `${Math.floor(days / 30)} mies. (młoda)`;
  if (days < 365) return `${Math.floor(days / 30)} mies. (poniżej roku)`;
  const y = Math.floor(days / 365);
  const m = Math.floor((days % 365) / 30);
  return `${y} ${y === 1 ? "r." : "l."}${m > 0 ? ` i ${m}m.` : ""} (dojrzała)`;
};

export const getDomainFromUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const getScoreVisuals = (
  score: number | null,
  isLoading: boolean = false,
  errorOccurred: boolean = false
): {
  bgColor: string;
  textColor: string;
  ringColor: string;
  description: string;
  scoreText: string | React.ReactElement;
} => {
  let bgColor = "bg-gray-400";
  let textColor = "text-gray-700";
  let ringColor = "ring-gray-400";
  let description = "Analizowanie...";
  let scoreText: string | React.ReactElement = "?";

  if (isLoading && score === null && !errorOccurred) {
    description = "Analizowanie...";
    // scoreText pozostaje "?" lub można dać ikonę loadera, ale to w komponencie
  } else if (errorOccurred && score === null) {
    description = "Błąd Oceny";
    bgColor = "bg-red-500";
    textColor = "text-white";
    ringColor = "ring-red-500";
  } else if (score === null && !isLoading) {
    description = "Brak Oceny";
  } else if (score !== null) {
    scoreText = score.toString();
    if (score < 40) {
      bgColor = "bg-red-500";
      textColor = "text-white";
      ringColor = "ring-red-500";
      description = "Wysokie Ryzyko";
    } else if (score < 70) {
      bgColor = "bg-yellow-500";
      textColor = "text-black";
      ringColor = "ring-yellow-500";
      description = "Podwyższone Ryzyko";
    } else {
      bgColor = "bg-green-500";
      textColor = "text-white";
      ringColor = "ring-green-500";
      description = "Niskie Ryzyko";
    }
  }

  return { bgColor, textColor, ringColor, description, scoreText };
};
