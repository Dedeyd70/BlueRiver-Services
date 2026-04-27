import { ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SummaryField {
  label: string;
  value: ReactNode;
}

interface Props {
  /** Used by useFocusHighlight to scroll-to + ring-highlight the card. */
  innerRef?: (el: HTMLDivElement | null) => void;
  /** 4-field summary row shown when collapsed. */
  summary: SummaryField[];
  /** Status pill on the right of the summary header. */
  statusBadge?: ReactNode;
  /** Optional left-side type badge (Booking / Quote / Contact). */
  typeBadge?: ReactNode;
  /** Title row (e.g. customer name). */
  title: ReactNode;
  /** Subtitle (e.g. email / phone). */
  subtitle?: ReactNode;
  /** Full details + action footer rendered when expanded. */
  children: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  /** Visual hint that the record is read-only (archived). */
  readOnly?: boolean;
}

const CollapsibleRecordCard = ({
  innerRef,
  summary,
  statusBadge,
  typeBadge,
  title,
  subtitle,
  children,
  expanded,
  onToggle,
  readOnly = false,
}: Props) => {
  return (
    <div
      ref={innerRef}
      className={`bg-card border border-border rounded-xl overflow-hidden scroll-mt-24 transition-shadow ${
        readOnly ? "opacity-90" : ""
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {typeBadge}
              <h3 className="font-medium text-foreground truncate">{title}</h3>
            </div>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {statusBadge}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
          {summary.map((f, i) => (
            <div key={i} className="min-w-0">
              <span className="text-xs text-muted-foreground block">{f.label}</span>
              <span className="font-medium text-foreground text-sm truncate block">
                {f.value ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-border/50 space-y-3">{children}</div>
      )}
    </div>
  );
};

export default CollapsibleRecordCard;
