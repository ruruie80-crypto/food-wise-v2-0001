import type { Metadata } from "next";
import { MealsScreen } from "@/components/screens/meals-screen";

export const metadata: Metadata = { title: "献立" };
export const instant = false;

export default function Page() {
  return <MealsScreen />;
}
