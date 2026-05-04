import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import PermissionGate from "@/components/PermissionGate";

export interface ActivityEntry {
  id: string;
  action?: string | null;
  details?: string | null;
  notes?: string | null;
  actor_id?: string | null;
  created_at: string;
}

interface RecordActivityPanelProps {
  entries: ActivityEntry[];
  resolveActor: (id?: string | null) => string;
  actionLabels?: Record<string, string>;
  permission?: string;
  onAddNote?: (note: string) => void | Promise<void>;
  /** Default: collapsible. Pass false to render expanded inline. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  readOnly?: boolean;
}

/**
 * Shared activity log + add-note panel used across Bookings, Quotes, and
 * Contact Messages so all admin records share an identical pattern.
 */
const RecordActivityPanel = ({
  entries,
  resolveActor,
  actionLabels = {},
  permission,
  onAddNote,
  collapsible = true,
  defaultOpen = false,
  readOnly = false,
}: RecordActivityPanelProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [draft, setDraft] = useState("");
  const isOpen = collapsible ? open : true;

  const list = (
    <div className="mt-3 space-y-2">
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No activity recorded yet.</p>
      )}
      {entries.map((entry) => {
        const label = actionLabels[entry.action ?? ""] ?? (entry.action ? entry.action.replace(/_/g, " ") : "Note");
        return (
          <div key={entry.id} className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground capitalize">
                {label}
                <span className="text-xs font-normal text-muted-foreground ml-1 normal-case">
                  by {resolveActor(entry.actor_id)}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
            {entry.details && (
              <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
            )}
            {entry.notes && (
              <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{entry.notes}</p>
            )}
          </div>
        );
      })}

      {!readOnly && onAddNote && (
        <PermissionGate permission={permission ?? ""}>
          <div className="flex gap-2 pt-2">
            <Textarea
              rows={2}
              placeholder="Add a note…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const v = draft.trim();
                if (!v) return;
                await onAddNote(v);
                setDraft("");
              }}
              disabled={!draft.trim()}
            >
              Add note
            </Button>
          </div>
        </PermissionGate>
      )}
    </div>
  );

  return (
    <div className="border-t border-border pt-3">
      {collapsible ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <Clock className="w-3.5 h-3.5" /> Activity ({entries.length})
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {isOpen && list}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Clock className="w-3.5 h-3.5" /> Activity ({entries.length})
          </div>
          {list}
        </>
      )}
    </div>
  );
};

export default RecordActivityPanel;
