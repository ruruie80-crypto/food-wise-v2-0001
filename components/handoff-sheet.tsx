"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { buildHandoffZip, parseHandoff, readHandoffZip } from "@/lib/handoff";

type Preview = { exportedOn: string; record: unknown };

export function saveHandoffZip(record: Parameters<typeof buildHandoffZip>[0], today: string, stale: boolean) {
  const file = buildHandoffZip(record, today, stale);
  const bytes = file.bytes.slice();
  const blob = new Blob([bytes.buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function HandoffSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const app = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const close = (next: boolean) => {
    if (!next) setPreview(null);
    onOpenChange(next);
  };

  const pack = () => {
    if (!app.today) return null;
    return buildHandoffZip(app.state, app.today, app.stale);
  };

  const download = () => {
    if (!app.today) return;
    saveHandoffZip(app.state, app.today, app.stale);
    toast.success("Zipをダウンロードしました");
  };

  const copy = async () => {
    const file = pack();
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.text);
      toast.success("渡すメモをコピーしました");
    } catch {
      toast.error("コピーできませんでした");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const zipped = file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip";
    const parsed = zipped ? readHandoffZip(new Uint8Array(await file.arrayBuffer())) : parseHandoff(await file.text());
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    setPreview({ exportedOn: parsed.exportedOn, record: parsed.record });
  };

  const apply = () => {
    if (!preview) return;
    const summary = app.acceptHandoff(preview.record);
    setPreview(null);
    onOpenChange(false);
    toast.success(`記録を受け取りました。${summary}`);
  };

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-3xl">
        <SheetHeader>
          <SheetTitle>記録を渡す</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 overflow-y-auto px-4 pb-6 text-sm leading-6">
          <p className="text-[#5e574c]">
            献立、買い物、読んだ値札を1つの Zip にします。メモ.txt はそのまま読めます。相手は底値ごはんでこの Zip を開くと、同じ週を続けられます。アプリから送信はしません。
          </p>
          {preview ? (
            <div className="rounded-2xl bg-[#fff4c2] px-3 py-3">
              <p className="font-bold">{preview.exportedOn || "日付なし"} の記録です</p>
              <p className="mt-1">この端末の献立と値札を、ファイルの内容に入れ替えます。</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-11" onClick={() => setPreview(null)}>
                  やめる
                </Button>
                <Button type="button" className="h-11" onClick={apply}>
                  入れ替える
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button type="button" className="h-11 w-full" onClick={download}>
                Zipをダウンロード
              </Button>
              <Button type="button" variant="outline" className="h-11 w-full" onClick={copy}>
                読めるメモをコピー
              </Button>
              <Button type="button" variant="outline" className="h-11 w-full" onClick={() => fileRef.current?.click()}>
                受け取ったファイルを開く
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/zip,.zip,application/json,.json"
                className="hidden"
                onChange={(event) => {
                  void onFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
