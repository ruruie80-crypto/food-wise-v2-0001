import type { Metadata } from "next";
import { StockScreen } from "@/components/screens/stock-screen";

export const metadata: Metadata = { title: "冷蔵庫・冷凍庫" };
export const instant = false;

export default function Page() {
  return <StockScreen />;
}
