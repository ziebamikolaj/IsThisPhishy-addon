export interface SSLInfo {
  issuer: { [key: string]: string } | null;
  subject: { [key: string]: string } | null;
  version: number | null;
  serial_number: string | null;
  not_before: string | null;
  not_after: string | null;
}

export interface WhoisInfo {
  registrar: string | null;
  creation_date: string | null;
  expiration_date: string | null;
  updated_date: string | null;
  name_servers: string[] | null;
  emails: string[] | null;
  status: string[] | null;
}

export interface BlacklistCheckResult {
  source: string;
  is_listed: boolean;
  details: unknown | null;
}

export interface DomainAnalysisDetails {
  domain_name: string | null;
  parsed_url_scheme: string | null;
  parsed_url_path: string | null;
  parsed_url_query: string | null;
  dns_records: { [key: string]: string[] } | null;
  ssl_info: SSLInfo | null;
  whois_info: WhoisInfo | null;
  domain_actual_age_days: number | null;
  blacklist_checks: BlacklistCheckResult[] | null;
  is_ip_address_in_url: boolean;
  error: string | null;
}

export interface PhishingTextAnalysis {
  is_phishing: boolean;
  confidence: number;
  label: string;
}

export interface PageContentAiAnalysis extends PhishingTextAnalysis {
  chunkIndex: number; // Indeks analizowanego fragmentu
  originalChunk: string; // Fragment tekstu, który był analizowany
}

export type StoredDomainData = {
  analysis?: DomainAnalysisDetails;
  urlTextAnalysis?: PhishingTextAnalysis | null; // Zmieniona nazwa dla jasności
  pageContentAnalyses?: PageContentAiAnalysis[] | null; // NOWE: Wyniki analizy treści strony
  lastChecked: number;
  error?: string;
  isLoading?: boolean;
};
