export function HomeDishTitle({ title, note }: { title: string; note: string }) {
  return (
    <>
      <p className="mt-1 text-xl font-black">{title}</p>
      {note ? <p className="text-sm leading-5 text-muted-foreground">{note}</p> : null}
    </>
  );
}
