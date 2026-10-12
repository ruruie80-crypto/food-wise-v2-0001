import { connection } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import {
  hasPdfHeader,
  isPdfContentType,
  MARKET_NOTE,
  MARKET_PAGE,
  MARKET_PDF,
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  MAX_REPORT_TEXT,
  type MarketReport,
  nextPdfUrl,
  parseMarketReport,
  readAtMost,
} from "@/lib/market";

const SUCCESS_MS = 30 * 60 * 1000;
const FAILURE_MS = 60 * 1000;
const PARSE_MS = 8_000;
const SUCCESS_CACHE = "public, s-maxage=1800, stale-while-revalidate=86400";
const STALE_CACHE = "public, s-maxage=60, stale-while-revalidate=1800";
const FAILURE_CACHE = "public, s-maxage=60";

type SuccessBody = MarketReport & {
  ok: true;
  note: string;
  sourceUrl: string;
  pageUrl: string;
};

type Outcome = {
  status: number;
  cache: string;
  body: SuccessBody | { ok: false; error: string; pageUrl: string };
};

let success: { at: number; body: SuccessBody } | null = null;
let failureAt = 0;
let inflight: Promise<Outcome> | null = null;

function failureBody() {
  return { ok: false as const, error: "日報を取れませんでした。", pageUrl: MARKET_PAGE };
}

function json(outcome: Outcome) {
  return Response.json(outcome.body, {
    status: outcome.status,
    headers: { "Cache-Control": outcome.cache },
  });
}

function deadline<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("pdf parse timed out"));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(new Error("pdf parse timed out"));
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function textFromPdf(bytes: Uint8Array): Promise<string> {
  const signal = AbortSignal.timeout(PARSE_MS);
  const doc = await deadline(getDocumentProxy(bytes), signal);
  try {
    if (doc.numPages > MAX_PDF_PAGES) throw new Error(`pdf has ${doc.numPages} pages`);
    const extracted = await deadline(extractText(doc, { mergePages: true }), signal);
    if (typeof extracted.text !== "string" || extracted.text.length > MAX_REPORT_TEXT) {
      throw new Error("pdf text is unusable");
    }
    return extracted.text;
  } finally {
    await doc.loadingTask.destroy().catch(() => undefined);
  }
}

async function fetchPdf(signal: AbortSignal): Promise<Uint8Array> {
  let url = MARKET_PDF;
  for (let hop = 0; hop < 2; hop += 1) {
    const response = await fetch(url, {
      headers: { "user-agent": "sokone-gohan", accept: "application/pdf" },
      cache: "no-store",
      redirect: "manual",
      signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const next = hop === 0 ? nextPdfUrl(url, response.headers.get("location")) : null;
      await response.body?.cancel();
      if (!next) throw new Error("pdf redirect was refused");
      url = next;
      continue;
    }
    if (!response.ok) throw new Error(`pdf responded ${response.status}`);
    if (!isPdfContentType(response.headers.get("content-type"))) throw new Error("pdf content-type was refused");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && (declared <= 0 || declared > MAX_PDF_BYTES)) {
      await response.body?.cancel();
      throw new Error("pdf content-length was refused");
    }
    if (!response.body) throw new Error("pdf body was empty");
    const bytes = await readAtMost(response.body, MAX_PDF_BYTES);
    if (!hasPdfHeader(bytes)) throw new Error("pdf header was missing");
    return bytes;
  }
  throw new Error("pdf redirect was refused");
}

async function load(): Promise<Outcome> {
  try {
    const bytes = await fetchPdf(AbortSignal.timeout(10_000));
    const report = parseMarketReport(await textFromPdf(bytes));
    if (!report) throw new Error("pdf did not contain a market report");
    const body: SuccessBody = {
      ok: true,
      ...report,
      note: MARKET_NOTE,
      sourceUrl: MARKET_PDF,
      pageUrl: MARKET_PAGE,
    };
    success = { at: Date.now(), body };
    failureAt = 0;
    return { status: 200, cache: SUCCESS_CACHE, body };
  } catch (error) {
    console.error("market report failed", error);
    failureAt = Date.now();
    if (success) return { status: 200, cache: STALE_CACHE, body: success.body };
    return { status: 502, cache: FAILURE_CACHE, body: failureBody() };
  }
}

export async function GET() {
  await connection();
  const now = Date.now();
  if (success && now - success.at < SUCCESS_MS) return json({ status: 200, cache: SUCCESS_CACHE, body: success.body });
  if (now - failureAt < FAILURE_MS) {
    if (success) return json({ status: 200, cache: STALE_CACHE, body: success.body });
    return json({ status: 502, cache: FAILURE_CACHE, body: failureBody() });
  }
  if (!inflight) {
    const job = load().finally(() => {
      if (inflight === job) inflight = null;
    });
    inflight = job;
  }
  return json(await inflight);
}
