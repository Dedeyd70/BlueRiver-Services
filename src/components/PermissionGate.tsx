import { cloneElement, isValidElement, ReactElement, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissionRegistry } from "@/hooks/usePermissions";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  permission: string;
  /** "disable" (default) keeps the child visible but disabled with a tooltip.
   *  "hide"    removes the child entirely (legacy HasPermission behaviour). */
  mode?: "disable" | "hide";
  /** Optional override for the disabled-state tooltip text. */
  tooltip?: string;
  children: ReactNode;
}

/**
 * Wraps an action element. If the user lacks `permission` the element is
 * either hidden or rendered in a disabled state with an explanatory tooltip.
 * Admins always pass through.
 */
const PermissionGate = ({ permission, mode = "disable", tooltip, children }: Props) => {
  const { role, permissions } = useAuth();
  const { data: registry } = usePermissionRegistry();

  const allowed = role === "admin" || permissions?.[permission] === true;
  if (allowed) return <>{children}</>;

  if (mode === "hide") return null;

  const label = registry?.find((p) => p.key === permission)?.label ?? permission;
  const tip = tooltip ?? `Requires '${label}' permission.`;

  // Try to disable a single React element child. Fall back to a wrapping span
  // (with pointer-events disabled) for fragments / multiple children.
  if (isValidElement(children)) {
    const child = children as ReactElement<{ disabled?: boolean; className?: string }>;
    const disabled = cloneElement(child, {
      disabled: true,
      className: [child.props.className, "opacity-60 cursor-not-allowed"].filter(Boolean).join(" "),
    });
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">{disabled}</span>
          </TooltipTrigger>
          <TooltipContent>{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex opacity-60 cursor-not-allowed pointer-events-none">{children}</span>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PermissionGate;
