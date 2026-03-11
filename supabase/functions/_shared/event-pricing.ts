type PricingField = {
  key?: unknown;
  type?: unknown;
  options?: unknown;
  option_prices?: Record<string, unknown> | null;
};

const ROUTE_FIELD_KEYS = new Set(["disciplina", "percorso", "route", "distance"]);

function normalizePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }

  return null;
}

function asPricingFields(customFields: unknown): PricingField[] {
  if (!Array.isArray(customFields)) {
    return [];
  }

  return customFields.filter(
    (field): field is PricingField =>
      !!field && typeof field === "object" && !Array.isArray(field),
  );
}

function hasOptions(field: PricingField): field is PricingField & { key: string; options: string[] } {
  return (
    typeof field.key === "string" &&
    field.type === "select" &&
    Array.isArray(field.options) &&
    field.options.every((option) => typeof option === "string") &&
    field.options.length > 0
  );
}

function isPricedField(field: PricingField): field is PricingField & { key: string; options: string[] } {
  if (!hasOptions(field)) {
    return false;
  }

  return field.options.some((option) => normalizePrice(field.option_prices?.[option]) !== null);
}

function getPricingField(customFields: unknown) {
  const pricedFields = asPricingFields(customFields).filter(isPricedField);
  const preferredField = pricedFields.find((field) => ROUTE_FIELD_KEYS.has(field.key));

  return preferredField || pricedFields[0] || null;
}

export function resolveEventPrice(
  basePrice: number,
  customFields: unknown,
  customData: Record<string, unknown> = {},
): number {
  const pricingField = getPricingField(customFields);

  if (!pricingField) {
    return basePrice;
  }

  const selectedOption = customData[pricingField.key];
  if (typeof selectedOption !== "string") {
    return basePrice;
  }

  const optionPrice = normalizePrice(pricingField.option_prices?.[selectedOption]);

  return optionPrice ?? basePrice;
}
