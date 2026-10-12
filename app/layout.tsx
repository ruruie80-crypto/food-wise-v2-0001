import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Zen_Kaku_Gothic_New } from "next/font/google";
import { connection } from "next/server";
import { AppStateProvider } from "@/components/app-state";
import { Shell } from "@/components/shell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const zen = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
  preload: false,
  variable: "--font-zen",
});

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: {
    default: "底値ごはん",
    template: "%s · 底値ごはん",
  },
  description:
    "公開用の試作。見本の相場と、端末の中だけに残る値札から、今週の食費で献立と買い物リストを作る。",
  openGraph: {
    title: "底値ごはん",
    description:
      "公開用の試作。相場は見本で、記録はこのブラウザの中だけに残ります。決済も在庫もつながっていません。",
    locale: "ja_JP",
    type: "website",
  },
  robots: { index: true, follow: true },
  applicationName: "底値ごはん",
  icons: { icon: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "底値ごはん",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#1b6b43",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="ja" className={`${zen.variable} ${barlow.variable} h-full antialiased`}>
      <body className="min-h-dvh bg-[#e7dfd0] text-[#1c1915]">
        <AppStateProvider>
          <Shell>{children}</Shell>
          <Toaster position="top-center" />
        </AppStateProvider>
      </body>
    </html>
  );
}
