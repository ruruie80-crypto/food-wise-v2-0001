import type { Metadata } from "next";
import { HomeScreen } from "@/components/screens/home-screen";

export const metadata: Metadata = { title: "ホーム" };
export const instant = false;

export default function Page() {
  return <HomeScreen />;
}
