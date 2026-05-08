import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface LegalContentProps {
  body?: string | null;
  updatedAt?: string | null;
  className?: string;
}

type Block =
  | { type: "h2" | "h3" | "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*(?:\d+[.)]|[a-zA-Z][.)])\s+(.*)$/;
const NUMBERED_HEADING_RE = /^\d+(\.\d+)*[.)]?\s+\S/;

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 70) return false;
  if (t.split(/\s+/).length > 10) return false;
  if (/[.,;:?!]$/.test(t)) return false;
  if (UL_RE.test(t) || OL_RE.test(t)) return false;
  return true;
}

function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  const raw = body.replace(/\r\n/g, "\n").trim();
  if (!raw) return blocks;

  const chunks = raw.split(/\n{2,}/);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;

    // List detection
    const allUl = lines.every((l) => UL_RE.test(l));
    const allOl = lines.every((l) => OL_RE.test(l));
    if (allUl) {
      blocks.push({ type: "ul", items: lines.map((l) => l.replace(UL_RE, "$1").trim()) });
      continue;
    }
    if (allOl) {
      blocks.push({ type: "ol", items: lines.map((l) => l.replace(OL_RE, "$1").trim()) });
      continue;
    }

    // Heading detection (single short line)
    if (lines.length === 1) {
      const t = lines[0].trim();
      if (NUMBERED_HEADING_RE.test(t)) {
        blocks.push({ type: "h3", text: t });
        continue;
      }
      if (isHeadingLine(t)) {
        blocks.push({ type: "h2", text: t });
        continue;
      }
    }

    blocks.push({ type: "p", text: lines.join("\n") });
  }

  return blocks;
}

const LegalContent = ({ body, updatedAt, className }: LegalContentProps) => {
  const blocks = useMemo(() => parseBlocks(body || ""), [body]);

  const formattedDate = useMemo(() => {
    if (!updatedAt) return null;
    const d = new Date(updatedAt);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }, [updatedAt]);

  if (!body || blocks.length === 0) {
    return <p className="text-muted-foreground text-center">Content not available.</p>;
  }

  let firstHeadingSeen = false;

  return (
    <article className={cn("max-w-none space-y-5", className)}>
      {formattedDate && (
        <p className="text-sm text-muted-foreground italic border-b border-border pb-4 mb-2">
          Last updated: {formattedDate}
        </p>
      )}
      {blocks.map((block, i) => {
        if (block.type === "h2") {
          const isFirst = !firstHeadingSeen;
          firstHeadingSeen = true;
          return (
            <h2
              key={i}
              className={cn(
                "text-2xl font-display font-bold text-foreground tracking-tight mb-3",
                isFirst ? "mt-0" : "mt-10"
              )}
            >
              {block.text}
            </h2>
          );
        }
        if (block.type === "h3") {
          firstHeadingSeen = true;
          return (
            <h3 key={i} className="text-lg font-display font-semibold text-foreground mt-6 mb-2">
              {block.text}
            </h3>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc pl-6 space-y-2 marker:text-primary text-foreground/85 leading-relaxed">
              {block.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="list-decimal pl-6 space-y-2 marker:text-primary text-foreground/85 leading-relaxed">
              {block.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "p") {
          return (
            <p key={i} className="leading-relaxed text-foreground/85 whitespace-pre-line">
              {block.text}
            </p>
          );
        }
        return null;
      })}
    </article>
  );
};

export default LegalContent;
