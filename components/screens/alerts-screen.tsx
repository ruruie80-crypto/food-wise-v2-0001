"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useApp } from "@/components/app-state";
import { BootScreen } from "@/components/bits";
import { Button } from "@/components/ui/button";

export function AlertsScreen() {
  const { ready, alerts, markAlertsRead, reset } = useApp();
  useEffect(() => {
    if (!ready) return;
    markAlertsRead();
  }, [ready, markAlertsRead]);

  if (!ready) return <BootScreen />;

  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <h1 className="text-[1.7rem] font-black tracking-tight">通知</h1>
      <p className="mt-1 text-sm leading-6 text-[#5e574c]">
        買い時、特売曜日、献立のなかで高い品。端末の中だけで出します。
      </p>
      {alerts.length === 0 ? (
        <p className="mt-6 rounded-3xl bg-white p-4 text-sm">いま届けることはありません。</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <Link href={alert.href} className="block rounded-3xl bg-white p-4">
                <p className="text-[11px] font-bold tracking-[0.14em] text-[#1b6b43]">
                  {alert.tone === "buy" ? "買い時" : alert.tone === "sale" ? "特売日" : alert.tone === "plan" ? "献立" : "スキャン"}
                </p>
                <p className="mt-1 font-black">{alert.title}</p>
                <p className="mt-1 text-sm leading-6 text-[#5e574c]">{alert.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="mt-6 h-11 w-full" onClick={() => reset()}>
        記録を消して最初から
      </Button>
      <p className="mt-4 text-xs leading-5 text-[#5e574c]">
        無料で底値・献立・買い物リスト。価格予測はプレミアムの見本。店への送客は、まだ実店舗の在庫とはつながっていません。
      </p>
    </div>
  );
}
