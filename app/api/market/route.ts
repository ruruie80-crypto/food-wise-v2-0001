import { extractText } from "unpdf";
import { MARKET_NOTE, MARKET_PAGE, MARKET_PDF, parseMarketReport } from "@/lib/market";

const TTL_MS = 30 * 60 * 1000;
let cached: { at: number; body: unknown } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return Response.json(cached.body);
  }
  try {
    const response = await fetch(MARKET_PDF, {
      headers: { "user-agent": "sokone-gohan" },
      cache: "no-store",
    });
    if (!response.ok) {
      return Response.json({ ok: false, error: "日報を取れませんでした。", pageUrl: MARKET_PAGE });
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const extracted = await extractText(bytes, { mergePages: true });
    const report = parseMarketReport(extracted.text);
    if (!report || report.items.length === 0) {
      return Response.json({ ok: false, error: "日報の品目を読めませんでした。", pageUrl: MARKET_PAGE });
    }
    const body = {
      ok: true as const,
      ...report,
      note: MARKET_NOTE,
      sourceUrl: MARKET_PDF,
      pageUrl: MARKET_PAGE,
    };
    cached = { at: Date.now(), body };
    return Response.json(body);
  } catch {
    return Response.json({ ok: false, error: "日報を読めませんでした。", pageUrl: MARKET_PAGE });
  }
}
