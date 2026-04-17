// Database-driven, integer-only pricing engine.
// No multipliers. No manual adjustment. All math via Math.round.

export interface LineItem {
  name: string;
  quantity: number;
  unit_price: number; // integer dollars
  total_price: number; // integer dollars
  type: "base" | "room" | "addon" | "condition";
}

export interface ServiceType {
  id: string;
  name: string;
  base_price: number;
}

export interface PricingRule {
  id: string;
  service_type_id: string;
  category: string; // Bedroom | Bathroom | FullBath | HalfBath | Kitchen | LivingRoom | OfficeRoom
  unit_price: number;
}

export interface ConditionSetting {
  id: string;
  name: string;
  surcharge_amount: number;
}

export interface QuoteRequestLike {
  service_type?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  full_bathrooms?: number | null;
  half_bathrooms?: number | null;
  kitchen_count?: number | null;
  living_rooms?: number | null;
  office_rooms?: number | null;
  condition_level?: string | null;
  selected_addons?: any;
  custom_fields?: Record<string, any> | null;
}

export interface ServiceField {
  id: string;
  service_type_id: string;
  field_key: string;
  label: string;
  input_type?: string;
  display_order?: number;
}

const intify = (n: any): number => {
  const v = Math.round(Number(n) || 0);
  return Number.isFinite(v) ? v : 0;
};

const parsePriceStarting = (p: any): number => {
  if (p == null) return 0;
  const n = parseInt(String(p).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export interface ComputeResult {
  lineItems: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export function computeQuote(
  request: QuoteRequestLike,
  serviceTypes: ServiceType[],
  rules: PricingRule[],
  conditions: ConditionSetting[],
  taxRate: number = 0,
  fields: ServiceField[] = []
): ComputeResult {
  const items: LineItem[] = [];

  const matchedService = serviceTypes.find(
    (s) => s.name.toLowerCase() === (request.service_type || "").toLowerCase()
  );

  // Base
  if (matchedService) {
    const base = intify(matchedService.base_price);
    items.push({
      name: `Base Service: ${matchedService.name}`,
      quantity: 1,
      unit_price: base,
      total_price: base,
      type: "base",
    });
  } else if (request.service_type) {
    items.push({
      name: `Base Service: ${request.service_type}`,
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      type: "base",
    });
  }

  const ruleFor = (cat: string) =>
    matchedService
      ? rules.find((r) => r.service_type_id === matchedService.id && r.category === cat)
      : undefined;

  // Read a field value from typed columns first, then custom_fields jsonb
  const readField = (key: string): number => {
    const r = request as any;
    const direct = r[key];
    if (direct !== undefined && direct !== null && direct !== "") return intify(direct);
    const custom = request.custom_fields ?? {};
    return intify(custom[key]);
  };

  // Dynamic fields path: if service_fields are provided for this service, render line items from them
  const serviceFields = matchedService
    ? fields
        .filter((f) => f.service_type_id === matchedService.id)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    : [];

  // Strict dynamic resolution only — pricing rules must match service_fields.field_key
  serviceFields.forEach((f) => {
    const qty = readField(f.field_key);
    if (!qty || qty <= 0) return;
    const rule = ruleFor(f.field_key);
    const unit = intify(rule?.unit_price ?? 0);
    items.push({
      name: f.label,
      quantity: qty,
      unit_price: unit,
      total_price: intify(qty * unit),
      type: "room",
    });
  });

  // Add-ons
  const addons = Array.isArray(request.selected_addons) ? request.selected_addons : [];
  addons.forEach((a: any) => {
    const price = intify(parsePriceStarting(a?.price ?? a?.price_starting));
    items.push({
      name: `Add-on: ${a?.title || "Item"}`,
      quantity: 1,
      unit_price: price,
      total_price: price,
      type: "addon",
    });
  });

  // Condition surcharge
  if (request.condition_level) {
    const cond = conditions.find(
      (c) => c.name.toLowerCase() === (request.condition_level || "").toLowerCase()
    );
    if (cond && intify(cond.surcharge_amount) > 0) {
      const surcharge = intify(cond.surcharge_amount);
      items.push({
        name: `Condition Surcharge (${cond.name})`,
        quantity: 1,
        unit_price: surcharge,
        total_price: surcharge,
        type: "condition",
      });
    }
  }

  const subtotal = items.reduce((s, i) => s + intify(i.total_price), 0);
  const tax = Math.round(subtotal * (Number(taxRate) || 0)) / 100;
  const total = Math.round(subtotal + tax);

  return { lineItems: items, subtotal, tax: Math.round(tax), total };
}

export function recomputeFromLineItems(items: LineItem[], taxRate: number = 0): ComputeResult {
  const normalized = items.map((i) => ({
    ...i,
    quantity: intify(i.quantity),
    unit_price: intify(i.unit_price),
    total_price: intify(intify(i.quantity) * intify(i.unit_price)),
  }));
  const subtotal = normalized.reduce((s, i) => s + i.total_price, 0);
  const tax = Math.round(subtotal * (Number(taxRate) || 0) / 100);
  const total = subtotal + tax;
  return { lineItems: normalized, subtotal, tax, total };
}
