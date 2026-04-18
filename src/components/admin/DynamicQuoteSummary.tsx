import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  serviceTypeId?: string | null;
  serviceTypeName?: string | null;
  request: any;
}

/**
 * Renders only the fields defined in service_fields for the request's service type.
 * Primary lookup is by serviceTypeId (ID-based). Falls back to name match for legacy
 * rows that don't yet have a service_type_id stored.
 * Reads value from typed column on quote_requests if present, otherwise from custom_fields jsonb.
 */
const DynamicQuoteSummary = ({ serviceTypeId, serviceTypeName, request }: Props) => {
  // Legacy fallback: resolve ID by name only when no serviceTypeId is provided
  const { data: resolvedId } = useQuery({
    queryKey: ["service-type-by-name", serviceTypeName?.toLowerCase()],
    queryFn: async () => {
      if (!serviceTypeName) return null;
      const { data } = await (supabase as any)
        .from("service_types")
        .select("id")
        .ilike("name", serviceTypeName)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !serviceTypeId && !!serviceTypeName,
  });

  const effectiveId = serviceTypeId || resolvedId || null;

  const { data: fields } = useQuery({
    queryKey: ["service-fields-for-summary", effectiveId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("service_fields")
        .select("*")
        .eq("service_type_id", effectiveId)
        .order("display_order");
      return data ?? [];
    },
    enabled: !!effectiveId,
  });

  if (!fields || fields.length === 0) return null;

  const readValue = (key: string) => {
    const direct = request?.[key];
    if (direct !== undefined && direct !== null && direct !== "") return direct;
    const custom = request?.custom_fields ?? {};
    const val = custom[key];
    return val !== undefined && val !== null && val !== "" ? val : null;
  };

  const formatValue = (v: any) => {
    if (v === null) return "—";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
  };

  return (
    <>
      {fields.map((f: any) => {
        const v = readValue(f.field_key);
        if (v === null) return null;
        return (
          <div key={f.id}>
            <span className="text-muted-foreground">{f.label}:</span>{" "}
            <span className="font-medium">{formatValue(v)}</span>
          </div>
        );
      })}
    </>
  );
};

export default DynamicQuoteSummary;
