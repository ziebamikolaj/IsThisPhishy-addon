import {
  StoredDomainData,
  // PageContentAiAnalysis, // Już niepotrzebny tutaj bezpośrednio
} from "@/types/domainAnalysis";
import { formatDomainAge } from "../utils/helpers";
import {
  ShieldQuestion,
  CalendarDays,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Network,
  MessageSquareQuote,
} from "lucide-react";

export type ExplanationImpact = "positive" | "negative" | "neutral" | "info";
export interface ScoreExplanation {
  id: string;
  icon: React.ElementType;
  label: string;
  valueText: string | React.ReactNode; // Zmienione z string na string | React.ReactNode
  impact: ExplanationImpact;
  details: string;
  longDesc?: string | React.ReactNode;
  scoreEffect?: string;
}

const PTS = {
  age: { y: -15, vy: -25, m: 10, vm: 15, unknown: -5 },
  ssl: { v: 10, e: -20, p: -20, h: -25, es: -5, unknown: -10 },
  bl: { l: -35, c: 5 },
  ip: -20,
  urlAi: { ph: -30, pm: -15, lh: 10, ll: 0, error: -5 },
  cAi: { ah: -25, ap: -15, ml: 5, error: -5, noContent: 0 },
};

export function calculateTrustScore( // ESLint może tu zgłaszać ostrzeżenie
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
    // tempSslSE już jest PTS.ssl.h
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

  let urlAiSEV = 0;
  let urlAiVT: string | React.ReactNode = "Niedostępna";
  let urlAiI: ExplanationImpact = "neutral";
  let urlAiDet =
    "Analiza AI adresu URL nie została przeprowadzona lub jest niedostępna.";

  if (urlAiAnalysis === null) {
    // Jawny błąd z API
    urlAiSEV = PTS.urlAi.error;
    urlAiVT = <span className="text-red-500">Błąd analizy</span>;
    urlAiI = "negative";
    urlAiDet =
      "Nie udało się przeprowadzić analizy AI dla tego URL z powodu błędu.";
  } else if (urlAiAnalysis) {
    // Analiza dostępna
    urlAiVT = `${urlAiAnalysis.label} (${(
      urlAiAnalysis.confidence * 100
    ).toFixed(0)}%)`;
    urlAiDet = `Model AI ocenił URL jako ${urlAiAnalysis.label.toLowerCase()} z ${(
      urlAiAnalysis.confidence * 100
    ).toFixed(0)}% pewnością.`;
    if (urlAiAnalysis.is_phishing) {
      urlAiI = "negative";
      if (urlAiAnalysis.confidence > 0.9) urlAiSEV = PTS.urlAi.ph;
      else urlAiSEV = PTS.urlAi.pm;
    } else if (urlAiAnalysis.confidence > 0.9) {
      urlAiSEV = PTS.urlAi.lh;
      urlAiI = "positive";
    } else {
      urlAiSEV = PTS.urlAi.ll;
      urlAiI = "neutral";
    }
  } else {
    // urlAiAnalysis jest undefined - brak danych, ale niekoniecznie błąd
    urlAiVT = <span className="text-gray-500">N/A (URL AI)</span>; // Zmieniony tekst
    urlAiI = "neutral"; // Traktuj jako neutralny, jeśli brak danych
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

  let cAiVT: string | React.ReactNode = "N/A";
  let cAiI: ExplanationImpact = "neutral",
    cAiSEV = 0;
  let cAiDet =
    "Analiza treści strony nie została przeprowadzona lub brakło tekstu.";
  let cAiLDReactNode: React.ReactNode =
    "Analiza treści strony wyszukuje fragmenty mogące wskazywać na oszustwo...";
  const sChunksI: { label: string; conf: number; chunk: string }[] = [];

  if (contentAiAnalyses === null) {
    // Jawny błąd analizy treści z API
    cAiVT = <span className="text-red-500">Błąd analizy treści</span>;
    cAiI = "negative";
    cAiSEV = PTS.cAi.error;
    cAiDet = "Wystąpił błąd podczas próby analizy treści strony.";
  } else if (contentAiAnalyses && contentAiAnalyses.length > 0) {
    let pC = 0,
      hCP = false,
      tCS = 0;
    contentAiAnalyses.forEach((ca) => {
      if (ca.is_phishing) {
        pC++;
        tCS += ca.confidence;
        if (ca.confidence > 0.9) hCP = true;
        sChunksI.push({
          label: ca.label,
          conf: ca.confidence,
          chunk: ca.originalChunk,
        });
      }
    });
    if (hCP) {
      cAiSEV = PTS.cAi.ah;
      cAiI = "negative";
      cAiVT = (
        <span className="text-red-500 font-semibold">Podejrzane Treści!</span>
      );
      cAiDet = `Wykryto fragmenty treści o wysokim prawdopodobieństwie phishingu (${pC}/${contentAiAnalyses.length}).`;
    } else if (pC > 0) {
      const avgC = tCS / pC;
      if (avgC > 0.5) {
        cAiSEV = PTS.cAi.ap;
        cAiI = "negative";
        cAiVT = "Podejrzane fragmenty";
        cAiDet = `Wykryto ${pC} z ${contentAiAnalyses.length} fragmentów jako potencjalnie phishingowe.`;
      } else {
        cAiI = "info";
        cAiVT = "Niejednoznaczne";
        cAiDet = `Niektóre fragmenty (${pC}/${contentAiAnalyses.length}) wydają się niejednoznaczne.`;
      }
    } else {
      cAiSEV = PTS.cAi.ml;
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
    // Analiza wykonana, ale brak chunków
    cAiSEV = PTS.cAi.noContent;
    cAiI = "info";
    cAiVT = "Brak tekstu do analizy";
    cAiDet =
      "Nie znaleziono wystarczającej ilości tekstu na stronie do przeprowadzenia pełnej analizy treści.";
  } else {
    // contentAiAnalyses jest undefined (nie było analizy, lub dane nie dotarły)
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

  let onBl = false,
    blSEV = 0;
  const blSrc: string[] = [];
  if (analysisData.blacklist_checks) {
    analysisData.blacklist_checks.forEach((c) => {
      if (c.is_listed) {
        onBl = true;
        blSrc.push(c.source);
      }
    });
  }
  if (onBl) {
    blSEV = PTS.bl.l;
    explanations.push({
      id: "blacklist",
      icon: ShieldAlert,
      label: "Listy zagrożeń",
      valueText: `Na listach: ${blSrc.join(", ")}`,
      impact: "negative",
      scoreEffect: `${blSEV} pkt`,
      details:
        "Znalezienie na publicznej liście zagrożeń jest silnym sygnałem ostrzegawczym.",
      longDesc: "Te listy są kompilowane przez organizacje bezpieczeństwa...",
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
      details: "Nie znaleziono na znanych listach zagrożeń.",
      longDesc: "Brak wpisów na głównych listach zagrożeń to dobry znak...",
    });
  }
  score += blSEV;

  let ipUrlSEV = 0;
  if (analysisData.is_ip_address_in_url) {
    ipUrlSEV = PTS.ip;
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

  const finalScore = Math.max(MIN, Math.min(MAX, Math.round(score)));
  console.log(
    `[ScoreCalc] Final calculated score: ${finalScore} (raw score before clamp: ${score})`
  );
  return { score: finalScore, explanations };
}
