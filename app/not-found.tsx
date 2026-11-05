import Link from "next/link";

export const instant = false;

export default function NotFound() {
  return (
    <div className="px-4 pt-16">
      <h1 className="text-2xl font-black">そのページはありません</h1>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center text-base font-bold text-primary">
        ホームへ戻る
      </Link>
    </div>
  );
}
