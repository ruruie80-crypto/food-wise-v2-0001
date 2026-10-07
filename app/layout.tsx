import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Zen_Kaku_Gothic_New } from "next/font/google";
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
    "値札やレシートから生活圏の底値を覚え、今週の食費のなかで栄養が偏らない献立と買い物リストを作る。",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
