"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Camera, House, ShoppingBasket, Tag, Utensils } from "lucide-react";
import { Onboarding } from "@/components/onboarding";
import { InsightRail } from "@/components/insight-rail";
import { useApp } from "@/components/app-state";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "ホーム", icon: House },
  { href: "/scan", label: "スキャン", icon: Camera },
  { href: "/prices", label: "底値", icon: Tag },
  { href: "/meals", label: "献立", icon: Utensils },
  { href: "/shop", label: "買う", icon: ShoppingBasket },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-background lg:grid lg:h-dvh lg:max-w-none lg:grid-cols-[92px_minmax(320px,460px)_minmax(280px,1fr)] lg:overflow-hidden lg:bg-canvas">
      <Suspense fallback={<div className="hidden lg:block" />}>
        <SideNav />
      </Suspense>
      <div className="skin-stage relative bg-background lg:min-h-0 lg:overflow-y-auto lg:border-x lg:border-border">
        <div className="pb-28 lg:pb-8">{children}</div>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
        <Suspense fallback={null}>
          <OnboardingGate />
        </Suspense>
      </div>
      <InsightRail />
    </div>
  );
}

function OnboardingGate() {
  const pathname = usePathname();
  const { ready, state } = useApp();
  if (!ready || state.onboarded || pathname === "/about") return null;
  return <Onboarding />;
}

function SideNav() {
  const pathname = usePathname();
  const { unreadCount } = useApp();
  return (
    <nav className="hidden flex-col gap-1 border-r border-border bg-nav px-2 py-4 lg:flex" aria-label="主要">
      <p className="px-1 pb-3 text-center text-[11px] leading-tight font-black tracking-tight">
        底値
        <span className="block">ごはん</span>
      </p>
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium",
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/alerts"
        className="mt-auto flex items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium text-foreground hover:bg-secondary"
      >
        <Bell className="size-4" />
        通知
        {unreadCount > 0 ? (
          <span className="rounded-full bg-destructive px-1.5 text-[10px] text-destructive-foreground">{unreadCount}</span>
        ) : null}
      </Link>
    </nav>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-30 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-5 border-t border-border bg-card/95 px-1 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
      aria-label="主要"
    >
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        const scan = item.href === "/scan";
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl py-1 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                scan &&
                  "-mt-4 size-12 border-4 border-card bg-primary text-panel-accent shadow-[0_8px_16px_var(--primary-shadow)]",
                !scan && active && "bg-chip",
              )}
            >
              <Icon className={scan ? "size-5" : "size-4"} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
