import type { Metadata } from "next";
import { ScanScreen } from "@/components/screens/scan-screen";

export const metadata: Metadata = { title: "スキャン" };
export const instant = false;

export default function Page() {
  return <ScanScreen />;
}
