import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "作品ノート",
  description: "底値ごはんは公開用の試作です。相場は見本で、記録はこの端末の中だけに残ります。",
};
export const instant = false;

const BOUNDS = [
  {
    title: "相場は見本",
    body: "東京の店名と値段は見本で、店は架空です。宮城県の店は実在します。ヨークベニマル、フレスコキクチ、イオン、みやぎ生協の店舗で、営業時間は各店の発表です。献立に使う宮城の値段は、総務省統計局の小売物価統計調査（仙台市・2026年8月）を単位換算した市内平均です。それとは別に、仙台市中央卸売市場の青果日報を開市日に読み、卸売の高値と安値を出します。スーパーの棚の特売ではありません。旬は東北農政局が仙台市周辺を基準にした表です。",
  },
  {
    title: "記録は端末の中",
    body: "アカウントはありません。予算、献立、値札はこのブラウザの中だけに残ります。サーバへは送りません。消すと、その端末の記録だけが消えます。",
  },
  {
    title: "写真は残さない",
    body: "カメラは、このサイトを開いているときだけ使えます。撮った画像は読み取りの確認に使い、保存も送信もしません。サンプルのレシートなら、カメラなしで最後まで試せます。",
  },
  {
    title: "予測と送客は画面だけ",
    body: "価格予測に月額の想定は書いてありますが、決済はつながっていません。店への案内も、在庫や注文には進みません。",
  },
  {
    title: "栄養は目安",
    body: "献立のたんぱく質や野菜は、予算との比較のための目安です。医療上の指導ではありません。",
  },
  {
    title: "Zipで渡せる",
    body: "献立と値札は、自分で書き出した Zip として渡せます。中のメモはそのまま読めます。アプリが相手へ送ることはありません。受け取った人は、底値ごはんでその Zip を開きます。",
  },
];

export default function AboutPage() {
  return (
    <div className="px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-10">
      <p className="text-[11px] font-bold tracking-[0.16em] text-primary">公開用の試作</p>
      <h1 className="text-[1.7rem] font-black tracking-tight">作品ノート</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        底値ごはんは、物価高の食卓を題材にしたポートフォリオ向けの試作です。値札から生活圏の底値を覚え、入れた食費のなかで献立と買い物リストを比べます。ホームの着せ替えで、帳面、夜の店、提灯、八百屋に見た目を変えられます。
      </p>

      <section className="mt-5 rounded-3xl bg-card p-4">
        <h2 className="font-black">解いていること</h2>
        <p className="mt-2 text-sm leading-6">
          献立は栄養、家計は金額に寄りがちです。この試作は、同じ週の食費に対して、金額だけの最安案と、野菜とたんぱく質を戻した案を並べます。
        </p>
        <p className="mt-2 text-sm leading-6">
          オンラインの価格比較は残しています。実店舗の生鮮は、自分で読んだ値札が帳面になる、という前提です。公開版の初期相場は見本です。
        </p>
      </section>

      <h2 className="mt-6 text-sm font-black">公開してよい境界</h2>
      <ul className="mt-3 space-y-3">
        {BOUNDS.map((item) => (
          <li key={item.title} className="rounded-3xl bg-card p-4">
            <p className="font-black">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
          </li>
        ))}
      </ul>

      <section className="mt-6 rounded-3xl bg-panel p-4 text-panel-foreground">
        <p className="text-[11px] font-bold tracking-[0.14em] text-panel-accent">試し方</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6">
          <li>5,000円ではじめて、朝と夜の献立を出す。</li>
          <li>スキャンでサンプルのレシートを記録する。</li>
          <li>底値の8週と、店ごとの今週を見る。</li>
          <li>バランスと最安を切り替え、買い物リストの差額を見る。</li>
        </ol>
      </section>

      <Link href="/" className="mt-6 inline-block text-sm font-bold text-primary">
        ホームへ戻る
      </Link>
    </div>
  );
}
