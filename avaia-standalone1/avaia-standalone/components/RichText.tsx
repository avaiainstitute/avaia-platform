import type { ReactNode } from "react";

/**
 * Minimal, dependency-free renderer for the light markdown the Guide produces —
 * **bold**, *italic*, headings, `---` rules and `-` bullet lists. Builds React
 * elements (never raw HTML), so there's no injection risk. Without this the Host
 * sees literal "**Host Overview**" and "---" in referrals.
 */

function inline(text: string, key: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(
        <strong key={`${key}-b${i++}`} className="font-semibold text-ink">
          {tok.slice(2, -2)}
        </strong>
      );
    } else {
      nodes.push(<em key={`${key}-i${i++}`}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function RichText({ text }: { text: string }) {
  // Split into blank-line separated blocks, then render each block by shape.
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.trim() !== "");
        if (lines.length === 0) return null;

        // A block of only rules
        if (lines.every((l) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l))) {
          return <hr key={bi} className="my-4 border-rule" />;
        }

        // Bullet list
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={bi} className="my-2 list-disc space-y-1 pl-5">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ""), `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }

        return (
          <div key={bi} className={bi > 0 ? "mt-3" : undefined}>
            {lines.map((l, li) => {
              const rule = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l);
              if (rule) return <hr key={li} className="my-4 border-rule" />;

              const h = l.match(/^\s*(#{1,4})\s+(.*)$/);
              if (h) {
                return (
                  <p key={li} className="mt-3 font-serif text-lg text-seal">
                    {inline(h[2], `${bi}-${li}`)}
                  </p>
                );
              }

              const bullet = l.match(/^\s*[-*•]\s+(.*)$/);
              if (bullet) {
                return (
                  <p key={li} className="flex gap-2 pl-1">
                    <span aria-hidden>•</span>
                    <span>{inline(bullet[1], `${bi}-${li}`)}</span>
                  </p>
                );
              }

              return <p key={li}>{inline(l, `${bi}-${li}`)}</p>;
            })}
          </div>
        );
      })}
    </>
  );
}
