import type { Metadata } from "next";
import { ShopScreen } from "@/components/screens/shop-screen";

export const metadata: Metadata = { title: "買い物" };
export const instant = false;

export default function Page() {
  return <ShopScreen />;
}
