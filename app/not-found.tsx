import Link from "next/link";

export const instant = false;

export default function NotFound() {
  return (
    <div className="px-4 pt-16">
      <h1 className="text-2xl font-black">そのページはありません</h1>
      <Link href="/" className="mt-4 inline-block font-bold text-[#1b6b43]">
        ホームへ戻る
      </Link>
    </div>
  );
}
