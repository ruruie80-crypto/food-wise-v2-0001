import type { Metadata } from "next";
import { AlertsScreen } from "@/components/screens/alerts-screen";

export const metadata: Metadata = { title: "通知" };
export const instant = false;

export default function Page() {
  return <AlertsScreen />;
}
