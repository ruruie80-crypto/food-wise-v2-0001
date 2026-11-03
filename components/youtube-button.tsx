import { youtubeCookUrl } from "@/lib/youtube";

export function YouTubeCookButton({ name }: { name: string }) {
  return (
    <a
      href={youtubeCookUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className="mt-2 flex min-h-12 items-center justify-center rounded-2xl bg-muted px-3 text-center text-base font-bold text-foreground"
    >
      YouTubeで作り方を見る
    </a>
  );
}
