import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  serviceTypeName: string | null | undefined;
  request: any;
}

/**
 * Renders only the fields defined in service_fields for the request's service type.
 * Reads value from typed column on quote_requests if present, otherwise from custom_fields jsonb.
 */
const DynamicQuoteSummary = ({ serviceTypeName, request }: Props) => {
  const { data: serviceType } = useQuery({
    queryKey: ["service-type-by-name", serviceTypeName?.toLowerCase()],
    queryFn: async () => {
      if (!serviceTypeName) return null;
      const { data } = await (supabase as any)
        .from("service_types")
        .select("id, name")
        .ilike("name", serviceTypeName)
        .maybeSingle();
      return data;
    },
    enabled: !!serviceTypeName,
  });

  const { data: fields } = useQuery({
    queryKey: ["service-fields-for-summary", serviceType?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("service_fields")
        .select("*")
        .eq("service_type_id", serviceType!.id)
        .order("display_order");
      return data ?? [];
    },
    enabled: !!serviceType?.id,
  });

  if (!fields || fields.length === 0) return null;

  const readValue = (key: string) => {
    const direct = request?.[key];
    if (direct !== undefined && direct !== null && direct !== "") return direct;
    const custom = request?.custom_fields ?? {};
    const val = custom[key];
    return val !== undefined && val !== null && val !== "" ? val : null;
  };

  const formatValue = (v: any, inputType: string) => {
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
            <span className="font-medium">{formatValue(v, f.input_type)}</span>
          </div>
        );
      })}
    </>
  );
};

export default DynamicQuoteSummary;
