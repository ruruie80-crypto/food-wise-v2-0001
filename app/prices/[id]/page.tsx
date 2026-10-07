import { notFound } from "next/navigation";
import { getIngredient, ingredients } from "@/lib/catalog";
import { PriceDetailScreen } from "@/components/screens/price-detail-screen";

export const instant = false;

export function generateStaticParams() {
  return ingredients.map((item) => ({ id: item.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ingredient = getIngredient(id);
  if (!ingredient) notFound();
  return <PriceDetailScreen id={id} />;
}
