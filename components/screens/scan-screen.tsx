"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getArea, getIngredient, getStore, ingredients, sampleReceipts, sampleTags, storesIn } from "@/lib/catalog";
import { surveyReceipt } from "@/lib/survey";
import { useApp, type ObservationDraft } from "@/components/app-state";
import { BootScreen, Yen } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { yen } from "@/lib/format";
import { cn } from "@/lib/utils";

type Line = { ingredientId: string; label: string; price: string };
type Mode = "tag" | "receipt";

export function ScanScreen() {
  const app = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("receipt");
  const [phase, setPhase] = useState<"capture" | "reading" | "review">("capture");
  const [storeId, setStoreId] = useState(sampleReceipts[0]?.storeId ?? "aoba");
  const [lines, setLines] = useState<Line[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (mode !== "tag" || phase !== "capture") return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraError(false);
      } catch {
        setCameraError(true);
      }
    };
    void start();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [mode, phase]);

  if (!app.ready || !app.book) return <BootScreen />;

  const area = getArea(app.state.areaId);
  const localStores = storesIn(area.id);
  const activeStoreId = localStores.some((store) => store.id === storeId) ? storeId : localStores[0]?.id ?? storeId;
  const receipts =
    area.priceBasis === "survey" ? [surveyReceipt(area.id)].filter((item) => item != null) : sampleReceipts;
  const tags = area.priceBasis === "survey" ? [] : sampleTags;

  const beginReview = (nextStore: string, nextLines: Line[], image: string | null) => {
    setStoreId(nextStore);
    setLines(nextLines);
    setPreview(image);
    setPhase("reading");
    const timer = window.setTimeout(() => setPhase("review"), 900);
    timers.current.push(timer);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      toast.error("カメラがまだ映っていません。サンプルの値札を使ってください。");
      return;
    }
    const scale = Math.min(1, 720 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    beginReview(storeId, [], canvas.toDataURL("image/jpeg", 0.7));
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      beginReview(storeId, [], typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    const drafts: ObservationDraft[] = [];
    for (const line of lines) {
      const price = Number(line.price);
      if (!line.ingredientId || !Number.isFinite(price) || price <= 0) {
        toast.error("品目と値段を確認してください。");
        return;
      }
      drafts.push({ ingredientId: line.ingredientId, storeId: activeStoreId, price, source: lines.length > 1 ? "receipt" : "tag" });
    }
    if (drafts.length === 0) {
      toast.error("記録する行がありません。");
      return;
    }
    const lows = app.addObservations(drafts);
    if (lows.length > 0) {
      const name = getIngredient(lows[0].ingredientId)?.name ?? "品目";
      toast.success(`${name}の底値を ${yen(lows[0].price)} に更新しました`);
    } else {
      toast.success(`${drafts.length}件を記録しました`);
    }
    setPhase("capture");
    setLines([]);
    setPreview(null);
  };

  const filtered = ingredients.filter((item) => {
    const needle = query.trim();
    if (!needle) return item.category !== "seasoning";
    return item.name.includes(needle) || item.kana.includes(needle.toLowerCase());
  });

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-8">
      <p className="text-[11px] font-bold tracking-[0.16em] text-primary">スキャン</p>
      <h1 className="text-[1.7rem] font-black tracking-tight">値札を底値にする</h1>
      <div className="mt-3 grid grid-cols-2 rounded-full bg-card p-1">
        {(
          [
            ["receipt", "レシート"],
            ["tag", "値札"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setMode(value);
              setPhase("capture");
            }}
            className={cn(
              "rounded-full py-2 text-sm font-bold",
              mode === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {phase === "reading" ? (
        <div className="relative mt-4 overflow-hidden rounded-3xl bg-panel px-4 py-16 text-center text-panel-foreground">
          <div className="scanline absolute right-6 left-6 h-0.5 bg-accent" />
          <p className="text-lg font-black">値段を拾っています</p>
          <p className="mt-2 text-sm text-panel-muted">店と品目を、次の画面で確認できます。</p>
        </div>
      ) : null}

      {phase === "capture" && mode === "receipt" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-muted-foreground">
            まずサンプルで試し読みできます。実物のレシートは、読み取った行を自分で直せます。写真は保存しません。
          </p>
          {receipts.map((receipt) => {
            const store = getStore(receipt.storeId);
            const total = receipt.lines.reduce((sum, line) => sum + line.price, 0);
            return (
              <article key={receipt.id} className="receipt rounded-b-3xl px-4 pt-4 pb-4">
                <p className="text-xs text-muted-foreground">{store?.name}</p>
                <h2 className="font-black">{receipt.title}</h2>
                {receipt.note ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{receipt.note}</p> : null}
                <ul className="mt-2 space-y-1 text-sm">
                  {receipt.lines.map((line) => (
                    <li key={line.label} className="flex justify-between">
                      <span>{line.label}</span>
                      <Yen value={line.price} />
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-right text-sm font-bold">合計 {yen(total)}</p>
                <Button
                  type="button"
                  className="mt-3 h-11 w-full"
                  onClick={() =>
                    beginReview(
                      receipt.storeId,
                      receipt.lines.map((line) => ({
                        ingredientId: line.ingredientId,
                        label: line.label,
                        price: String(line.price),
                      })),
                      null,
                    )
                  }
                >
                  このレシートを読み取る
                </Button>
              </article>
            );
          })}
        </div>
      ) : null}

      {phase === "capture" && mode === "tag" ? (
        <div className="mt-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-panel">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-4 rounded-2xl border-2 border-accent/80" />
            {cameraError ? (
              <p className="absolute inset-x-6 bottom-6 text-center text-sm leading-6 text-panel-foreground">
                カメラを使えないときは、下のサンプル値札かアルバムから選べます。
              </p>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" className="h-12" onClick={capture}>
              シャッター
            </Button>
            <Button type="button" variant="outline" className="h-12" onClick={() => fileRef.current?.click()}>
              アルバム
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
          <p className="mt-4 text-sm font-bold">サンプルの値札</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  beginReview(
                    tag.storeId,
                    [{ ingredientId: tag.ingredientId, label: tag.label, price: String(tag.price) }],
                    null,
                  )
                }
                className="flex items-center justify-between rounded-2xl bg-card px-3 py-3 text-left"
              >
                <span>
                  <span className="block text-xs text-muted-foreground">{getStore(tag.storeId)?.name}</span>
                  <span className="font-bold">{tag.label}</span>
                </span>
                <span className="rounded-[4px] bg-accent px-2 py-1 font-price text-2xl font-semibold shadow-[2px_2px_0_var(--foreground)]">
                  {yen(tag.price)}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase === "review" ? (
        <div className="mt-4 rounded-3xl bg-card p-4">
          <p className="text-sm font-bold">読み取りの確認</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            値札の文字は、この端末では自動では確定しません。店・品目・税込価格を直してから記録してください。
          </p>
          {preview ? (
            // 撮った直後の data URL。最適化配信の対象ではない。
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="撮った値札" className="mt-3 max-h-48 w-full rounded-2xl object-cover" />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {localStores.map((store) => (
              <button
                key={store.id}
                type="button"
                onClick={() => setStoreId(store.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-bold",
                  activeStoreId === store.id ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {store.name}
              </button>
            ))}
          </div>
          <ul className="mt-3 space-y-3">
            {lines.map((line, index) => (
              <li key={`${line.ingredientId}-${index}`} className="rounded-2xl bg-muted p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{getIngredient(line.ingredientId)?.name ?? "品目を選ぶ"}</span>
                  <button
                    type="button"
                    className="text-xs font-bold text-destructive"
                    onClick={() => setLines(lines.filter((_, lineIndex) => lineIndex !== index))}
                  >
                    削除
                  </button>
                </div>
                <label className="mt-2 block text-xs" htmlFor={`price-${index}`}>
                  税込価格
                </label>
                <Input
                  id={`price-${index}`}
                  inputMode="numeric"
                  value={line.price}
                  onChange={(event) => {
                    const next = [...lines];
                    next[index] = { ...line, price: event.target.value.replace(/[^\d]/g, "") };
                    setLines(next);
                  }}
                  className="mt-1 h-11 bg-card font-price text-2xl"
                />
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="mt-3 h-11 w-full" onClick={() => setPicker(true)}>
            品目を追加
          </Button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-12"
              onClick={() => {
                setPhase("capture");
                setPreview(null);
              }}
            >
              やめる
            </Button>
            <Button type="button" className="h-12" onClick={save}>
              記録する
            </Button>
          </div>
        </div>
      ) : null}

      <Sheet open={picker} onOpenChange={setPicker}>
        <SheetContent side="bottom" className="max-h-[80dvh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>品目を選ぶ</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4 pb-6">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="品目名" className="h-11 bg-card" aria-label="品目を探す" />
            <ul className="space-y-1">
              {filtered.slice(0, 30).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      const quote = app.book?.quote(item.id);
                      setLines((current) => [
                        ...current,
                        {
                          ingredientId: item.id,
                          label: item.name,
                          price: quote ? String(quote.unitPrice) : "",
                        },
                      ]);
                      setPicker(false);
                      setQuery("");
                    }}
                  >
                    <span className="font-bold">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.unitLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
