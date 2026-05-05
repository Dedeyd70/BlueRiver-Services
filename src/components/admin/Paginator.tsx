import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;            // 1-indexed
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

/** Lightweight client-side paginator. Default page size is 10 across all admin lists. */
const Paginator = ({ page, pageSize, total, onChange }: Props) => {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-col items-center justify-center gap-2 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(safePage - 1)}
          disabled={safePage <= 1}
          className="h-7 px-2"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <span className="text-foreground font-medium">
          {safePage} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange(safePage + 1)}
          disabled={safePage >= pageCount}
          className="h-7 px-2"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
      <span className="hidden sm:block">
        Showing <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </span>
    </div>
  );
};

export const PAGE_SIZE = 10;
export const usePagedSlice = <T,>(items: T[], page: number, pageSize = PAGE_SIZE): T[] => {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

export default Paginator;
