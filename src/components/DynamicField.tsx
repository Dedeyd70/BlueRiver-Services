import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

export interface DynamicFieldDef {
  id: string;
  field_key: string;
  label: string;
  input_type: string;
  required?: boolean;
  options?: any;
}

interface Props {
  field: DynamicFieldDef;
  value: any;
  onChange: (v: any) => void;
}

const DynamicField = ({ field, value, onChange }: Props) => {
  const required = field.required ? <span className="text-destructive"> *</span> : null;

  if (field.input_type === "select") {
    const options: string[] = Array.isArray(field.options) ? field.options : [];
    return (
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {field.label}
          {required}
        </label>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.input_type === "toggle") {
    return (
      <div className="flex items-center gap-2 h-10 sm:col-span-1">
        <Checkbox
          id={`dyn-${field.field_key}`}
          checked={!!value}
          onCheckedChange={(v) => onChange(!!v)}
        />
        <label htmlFor={`dyn-${field.field_key}`} className="text-sm font-medium text-foreground cursor-pointer">
          {field.label}
          {required}
        </label>
      </div>
    );
  }

  if (field.input_type === "textarea" || field.input_type === "text") {
    return (
      <div className="sm:col-span-2">
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          {field.label}
          {required}
        </label>
        {field.input_type === "textarea" ? (
          <Textarea
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder="Optional details…"
          />
        ) : (
          <Input
            type="text"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    );
  }

  // number (default)
  return (
    <div>
      <label className="text-sm font-medium text-foreground mb-1.5 block">
        {field.label}
        {required}
      </label>
      <Input
        type="number"
        min="0"
        max="100"
        placeholder="0"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export default DynamicField;
