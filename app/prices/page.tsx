import type { Metadata } from "next";
import { PricesScreen } from "@/components/screens/prices-screen";

export const metadata: Metadata = { title: "底値" };
export const instant = false;

export default function Page() {
  return <PricesScreen />;
}
