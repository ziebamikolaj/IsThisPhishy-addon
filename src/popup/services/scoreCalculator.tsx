// src/popup/services/scoreCalculator.tsx

import { StoredDomainData } from "@/types/domainAnalysis";
import {
  ShieldQuestion,
  CalendarDays,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Network,
  MessageSquareQuote,
  Mail,
} from "lucide-react";

// Simple formatDomainAge implementation
const formatDomainAge = (days: number): string => {
  if (days < 30) return `${days} dni`;
  if (days < 365) return `${Math.floor(days / 30)} mies.`;
  return `${Math.floor(days / 365)} lat`;
};

export type ExplanationImpact = "positive" | "negative" | "neutral" | "info";
export interface ScoreExplanation {
  id: string;
  icon: React.ElementType;
  label: string;
  valueText: string | React.ReactNode;
  impact: ExplanationImpact;
  details: string;
  longDesc?: string | React.ReactNode;
  scoreEffect?: string;
}

import { PTS } from "../consts/scorePoints";

export function calculateTrustScore(
  fullData: StoredDomainData | null | undefined,
  currentUrl: string
): { score: number | null; explanations: ScoreExplanation[] } {
  if (!fullData?.analysis) {
    console.warn(
      "[ScoreCalc] No analysis data provided for score calculation."
    );
    return { score: null, explanations: [] };
  }

  const analysisData = fullData.analysis;
  const urlAiAnalysis = fullData.urlTextAnalysis;
  const contentAiAnalyses = fullData.pageContentAnalyses;

  let score = 50;
  const explanations: ScoreExplanation[] = [];
  const MAX = 100,
    MIN = 0;

  console.log(
    "[ScoreCalc] Starting calculation. Initial score:",
    score,
    "for URL:",
    currentUrl
  );
  console.log(
    "[ScoreCalc] DomainAnalysisDetails:",
    JSON.parse(JSON.stringify(analysisData))
  );
  console.log(
    "[ScoreCalc] UrlTextAnalysis:",
    JSON.parse(JSON.stringify(urlAiAnalysis || {}))
  );
  console.log(
    "[ScoreCalc] PageContentAnalyses:",
    JSON.parse(JSON.stringify(contentAiAnalyses || []))
  );

  // Domain Age
  const ageD = analysisData.domain_actual_age_days;
  let ageI: ExplanationImpact = "neutral",
    ageSE = "0 pkt";
  let ageVT: string | React.ReactNode = "N/A";
  if (ageD !== null && typeof ageD !== "undefined") {
    ageVT = formatDomainAge(ageD);
    if (ageD < 30) {
      score += PTS.age.vy;
      ageI = "negative";
      ageSE = `${PTS.age.vy} pkt`;
    } else if (ageD < 180) {
      score += PTS.age.y;
      ageI = "negative";
      ageSE = `${PTS.age.y} pkt`;
    } else if (ageD >= 730) {
      score += PTS.age.vm;
      ageI = "positive";
      ageSE = `+${PTS.age.vm} pkt`;
    } else if (ageD >= 365) {
      score += PTS.age.m;
      ageI = "positive";
      ageSE = `+${PTS.age.m} pkt`;
    }
  } else {
    score += PTS.age.unknown;
    ageI = "info";
    ageSE = `${PTS.age.unknown} pkt (brak danych)`;
  }
  explanations.push({
    id: "age",
    icon: CalendarDays,
    label: "Wiek domeny",
    valueText: ageVT,
    impact: ageI,
    scoreEffect: ageSE,
    details: "Starsze domeny są generalnie bardziej wiarygodne.",
    longDesc:
      "Nowo zarejestrowane domeny są często wykorzystywane w kampaniach phishingowych...",
  });

  // SSL
  let sslI: ExplanationImpact = "negative",
    sslDet = "Strona nie używa szyfrowania HTTPS.",
    sslVT: string | React.ReactNode = "Brak (HTTP)";
  let tempSslSE = PTS.ssl.h;
  if (analysisData.parsed_url_scheme === "https") {
    tempSslSE = 0;
    if (analysisData.ssl_info && analysisData.ssl_info.not_after) {
      const expD = new Date(analysisData.ssl_info.not_after);
      const now = new Date();
      const dToExp = (expD.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (dToExp > 0) {
        tempSslSE = PTS.ssl.v;
        sslI = "positive";
        sslVT = "Ważny";
        sslDet = `Połączenie szyfrowane. Certyfikat ważny do: ${expD.toLocaleDateString()}.`;
        if (dToExp < 30) {
          tempSslSE += PTS.ssl.es;
          sslVT = (
            <span className="text-yellow-600 font-semibold">
              Wygasa wkrótce!
            </span>
          );
          sslDet += " Certyfikat wygasa za mniej niż 30 dni.";
        }
      } else {
        tempSslSE = PTS.ssl.e;
        sslI = "negative";
        sslVT = "Wygasł";
        sslDet = `Certyfikat SSL wygasł: ${expD.toLocaleDateString()}.`;
      }
    } else {
      tempSslSE = PTS.ssl.p;
      sslI = "negative";
      sslVT = "Problem (HTTPS)";
      sslDet =
        "Strona używa HTTPS, ale wystąpił problem z weryfikacją certyfikatu...";
    }
  } else if (
    analysisData.ssl_info === null &&
    analysisData.parsed_url_scheme !== "https"
  ) {
    sslI = "negative";
    sslVT = "Brak (HTTP)";
    sslDet = "Strona nie używa szyfrowania HTTPS (HTTP).";
  } else {
    tempSslSE = PTS.ssl.unknown;
    sslI = "info";
    sslVT = "N/A (SSL)";
    sslDet = "Nie udało się jednoznacznie zweryfikować statusu SSL.";
  }
  score += tempSslSE;
  const sslSETxt = `${tempSslSE > 0 ? "+" : ""}${tempSslSE} pkt`;
  explanations.push({
    id: "ssl",
    icon: Lock,
    label: "Szyfrowanie (SSL)",
    valueText: sslVT,
    impact: sslI,
    details: sslDet,
    scoreEffect: sslSETxt,
    longDesc:
      "Certyfikat SSL zapewnia szyfrowanie danych przesyłanych między Tobą a stroną...",
  });

  // URL AI Analysis
  let urlAiSEV = 0;
  let urlAiVT: string | React.ReactNode = "Niedostępna";
  let urlAiI: ExplanationImpact = "neutral";
  let urlAiDet =
    "Analiza AI adresu URL nie została przeprowadzona lub jest niedostępna.";

  if (urlAiAnalysis === null) {
    urlAiSEV = PTS.urlAi.error;
    urlAiVT = <span className="text-red-500">Błąd analizy</span>;
    urlAiI = "negative";
    urlAiDet =
      "Nie udało się przeprowadzić analizy AI dla tego URL z powodu błędu.";
  } else if (urlAiAnalysis) {
    urlAiVT = `${urlAiAnalysis.label} (${(
      urlAiAnalysis.confidence * 100
    ).toFixed(0)}%)`;
    urlAiDet = `Model AI ocenił URL jako ${urlAiAnalysis.label.toLowerCase()} z ${(
      urlAiAnalysis.confidence * 100
    ).toFixed(0)}% pewnością.`;
    if (urlAiAnalysis.is_phishing) {
      urlAiI = "negative";
      if (urlAiAnalysis.confidence >= 0.9) urlAiSEV = PTS.urlAi.ph90;
      else if (urlAiAnalysis.confidence >= 0.7) urlAiSEV = PTS.urlAi.ph70;
      else urlAiSEV = PTS.urlAi.ph50;
    } else {
      urlAiI = urlAiAnalysis.confidence >= 0.9 ? "positive" : "neutral";
      urlAiSEV =
        urlAiAnalysis.confidence >= 0.9
          ? PTS.urlAi.lh90
          : urlAiAnalysis.confidence >= 0.7
          ? PTS.urlAi.lh70
          : PTS.urlAi.neutral;
    }
  } else {
    urlAiVT = <span className="text-gray-500">N/A (URL AI)</span>;
    urlAiI = "neutral";
    urlAiDet =
      "Analiza AI adresu URL nie została jeszcze przeprowadzona lub dane nie są dostępne.";
  }
  explanations.push({
    id: "aiUrl",
    icon: ShieldQuestion,
    label: "Analiza AI URL",
    valueText: urlAiVT,
    impact: urlAiI,
    scoreEffect: `${urlAiSEV > 0 ? "+" : ""}${urlAiSEV} pkt`,
    details: urlAiDet,
    longDesc:
      "Sztuczna inteligencja analizuje strukturę i komponenty adresu URL...",
  });
  score += urlAiSEV;

  // Content AI Analysis
  let cAiVT: string | React.ReactNode = "N/A";
  let cAiI: ExplanationImpact = "neutral",
    cAiSEV = 0;
  let cAiDet =
    "Analiza treści strony nie została przeprowadzona lub brakło tekstu.";
  let cAiLDReactNode: React.ReactNode =
    "Analiza treści strony wyszukuje fragmenty mogące wskazywać na oszustwo...";
  const sChunksI: { label: string; conf: number; chunk: string }[] = [];

  if (contentAiAnalyses === null) {
    cAiVT = <span className="text-red-500">Błąd analizy treści</span>;
    cAiI = "negative";
    cAiSEV = PTS.contentAi.noContentOrError;
    cAiDet = "Wystąpił błąd podczas próby analizy treści strony.";
  } else if (contentAiAnalyses && contentAiAnalyses.length > 0) {
    let pC = 0,
      hCP = false,
      mCP = false,
      lCP = false;
    contentAiAnalyses.forEach((ca) => {
      if (ca.is_phishing) {
        pC++;
        if (ca.confidence >= 0.9) hCP = true;
        else if (ca.confidence >= 0.7) mCP = true;
        else if (ca.confidence >= 0.5) lCP = true;
        sChunksI.push({
          label: ca.label,
          conf: ca.confidence,
          chunk: ca.originalChunk,
        });
      }
    });

    if (pC > 0) {
      // Calculate penalty only if phishing chunks are found
      if (hCP) {
        cAiSEV = PTS.contentAi.phChunkHighConf;
        cAiI = "negative";
        cAiVT = (
          <span className="text-red-500 font-semibold">Podejrzane Treści!</span>
        );
        cAiDet = `Wykryto fragmenty treści o wysokim prawdopodobieństwie phishingu (${pC}/${contentAiAnalyses.length}).`;
      } else if (mCP) {
        cAiSEV = PTS.contentAi.phChunkMedConf;
        cAiI = "negative";
        cAiVT = "Podejrzane fragmenty";
        cAiDet = `Wykryto ${pC} z ${contentAiAnalyses.length} fragmentów jako potencjalnie phishingowe.`;
      } else if (lCP) {
        cAiSEV = PTS.contentAi.phChunkLowConf;
        cAiI = "negative";
        cAiVT = "Niejednoznaczne fragmenty";
        cAiDet = `Wykryto ${pC} z ${contentAiAnalyses.length} fragmentów jako potencjalnie phishingowe.`;
      }

      if (pC >= 3) {
        cAiSEV += PTS.contentAi.manyPhishingChunksPenalty;
        cAiDet += " Znaleziono wiele podejrzanych fragmentów.";
      }

      // <<< THIS IS THE FIX >>>
      // Cap the total penalty at -10 to prevent it from being too harsh.
      cAiSEV = Math.max(cAiSEV, -10);
    } else {
      // No phishing chunks were found
      cAiSEV = PTS.contentAi.noProblemDetected;
      cAiI = "positive";
      cAiVT = "Treść OK";
      cAiDet = `Analiza treści (${contentAiAnalyses.length} fragmentów) nie wykazała znamion phishingu.`;
    }

    if (sChunksI.length > 0) {
      const listItems = sChunksI.slice(0, 3).map((s, i) => (
        <li
          key={`chunk-${i}-${s.chunk.slice(0, 5)}`}
          title={s.chunk}
          className="mb-1"
        >
          <span
            className={`font-semibold ${
              s.label === "PHISHING" ? "text-red-600" : "text-gray-700"
            }`}
          >
            "{s.chunk.substring(0, 50)}..."
          </span>
          <span className="text-gray-500 ml-1">
            ({s.label} {(s.conf * 100).toFixed(0)}%)
          </span>
        </li>
      ));
      cAiLDReactNode = (
        <div>
          <p>
            {typeof cAiLDReactNode === "string"
              ? cAiLDReactNode
              : "Szczegóły analizy treści:"}
          </p>
          <p className="mt-2 font-semibold">Podejrzane fragmenty:</p>
          <ul className="list-disc pl-5 max-h-24 overflow-y-auto text-xs custom-scrollbar">
            {listItems}
          </ul>
          {sChunksI.length > 3 && (
            <p className="text-xs mt-1">...i {sChunksI.length - 3} więcej.</p>
          )}
        </div>
      );
    }
  } else if (contentAiAnalyses && contentAiAnalyses.length === 0) {
    cAiSEV = PTS.contentAi.noContentOrError;
    cAiI = "info";
    cAiVT = "Brak tekstu do analizy";
    cAiDet =
      "Nie znaleziono wystarczającej ilości tekstu na stronie do przeprowadzenia pełnej analizy treści.";
  } else {
    cAiVT = <span className="text-gray-500">N/A (treść)</span>;
    cAiI = "neutral";
    cAiDet =
      "Analiza treści strony nie została jeszcze przeprowadzona lub dane nie są dostępne.";
  }
  score += cAiSEV;
  explanations.push({
    id: "contentAi",
    icon: MessageSquareQuote,
    label: "Analiza AI treści",
    valueText: cAiVT,
    impact: cAiI,
    scoreEffect: `${cAiSEV > 0 ? "+" : ""}${cAiSEV} pkt`,
    details: cAiDet,
    longDesc: cAiLDReactNode,
  });

  // Blacklist
  let blSEV = 0;
  const listedSources: string[] = [];
  if (analysisData.blacklist_checks) {
    analysisData.blacklist_checks.forEach((c) => {
      if (c.is_listed) {
        listedSources.push(c.source);
      }
    });
  }
  if (listedSources.length > 0) {
    blSEV = PTS.bl.l; // Base penalty
    if (listedSources.length > 1) {
      blSEV += PTS.bl.multiple * (listedSources.length - 1); // Additional penalty
    }
    explanations.push({
      id: "blacklist",
      icon: ShieldAlert,
      label: "Listy zagrożeń",
      valueText: `Na listach: ${listedSources.join(", ")}`,
      impact: "negative",
      scoreEffect: `${blSEV} pkt`,
      details: `Znalezienie domeny/URL na publicznych listach zagrożeń (${listedSources.join(
        ", "
      )}) jest silnym sygnałem ostrzegawczym.`,
      longDesc:
        "Listy te są kompilowane przez organizacje bezpieczeństwa w celu śledzenia złośliwych witryn internetowych.",
    });
  } else {
    blSEV = PTS.bl.c;
    explanations.push({
      id: "blacklist",
      icon: ShieldCheck,
      label: "Listy zagrożeń",
      valueText: "Czysto",
      impact: "positive",
      scoreEffect: `+${blSEV} pkt`,
      details:
        "Nie znaleziono na znanych listach zagrożeń (m.in. PhishTank, CERT.PL, OpenPhish, Google Safe Browsing).",
      longDesc:
        "Brak wpisów na głównych listach zagrożeń to dobry znak, wskazujący, że strona nie została publicznie oznaczona jako złośliwa.",
    });
  }
  score += blSEV;

  // IP in URL
  let ipUrlSEV = 0;
  if (analysisData.is_ip_address_in_url) {
    ipUrlSEV = PTS.ipInUrl;
    explanations.push({
      id: "ipInUrl",
      icon: Network,
      label: "Adres IP w URL",
      valueText: "Tak",
      impact: "negative",
      scoreEffect: `${ipUrlSEV} pkt`,
      details:
        "Używanie adresu IP zamiast nazwy domenowej jest częstą taktyką w phishingu.",
      longDesc:
        "Legalne strony rzadko używają adresów IP bezpośrednio w linkach...",
    });
  } else {
    explanations.push({
      id: "ipInUrl",
      icon: Network,
      label: "Adres IP w URL",
      valueText: "Nie",
      impact: "positive",
      details: "URL używa standardowej nazwy domenowej.",
      scoreEffect: "+0 pkt",
    });
  }
  score += ipUrlSEV;

  // DNS MX Records
  let dnsMxSEV = 0;
  let dnsMxVT: string | React.ReactNode = "N/A";
  let dnsMxI: ExplanationImpact = "neutral";
  let dnsMxDet = "Brak danych o rekordach MX.";

  if (analysisData.dns_records && analysisData.dns_records.MX) {
    if (analysisData.dns_records.MX.length === 0) {
      dnsMxSEV = PTS.dnsMx.missingForShop;
      dnsMxVT = "Brak";
      dnsMxI = "negative";
      dnsMxDet = "Brak rekordów MX dla domeny.";
    } else {
      dnsMxSEV = PTS.dnsMx.presentForShop;
      dnsMxVT = "Obecne";
      dnsMxI = "positive";
      dnsMxDet = "Rekordy MX obecne dla domeny.";
    }
  } else {
    dnsMxSEV = PTS.dnsMx.notApplicable;
    dnsMxVT = "Nie dotyczy";
    dnsMxDet = "Brak danych o rekordach MX.";
  }
  score += dnsMxSEV;
  explanations.push({
    id: "dnsMx",
    icon: Mail,
    label: "Rekordy MX",
    valueText: dnsMxVT,
    impact: dnsMxI,
    scoreEffect: `${dnsMxSEV > 0 ? "+" : ""}${dnsMxSEV} pkt`,
    details: dnsMxDet,
    longDesc: "Rekordy MX wskazują serwery pocztowe dla domeny...",
  });

  const finalScore = Math.max(MIN, Math.min(MAX, Math.round(score)));
  console.log(
    `[ScoreCalc] Final calculated score: ${finalScore} (raw score before clamp: ${score})`
  );
  return { score: finalScore, explanations };
}
