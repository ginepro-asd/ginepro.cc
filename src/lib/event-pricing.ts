import type { CustomField } from "@/hooks/use-event";

const ROUTE_FIELD_KEYS = new Set(["disciplina", "percorso", "route", "distance"]);

function hasOptions(field: CustomField | null | undefined): field is CustomField & { options: string[] } {
  return !!field && Array.isArray(field.options) && field.options.length > 0;
}

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

function isPricedSelectField(field: CustomField | null | undefined): field is CustomField & { options: string[] } {
  if (!hasOptions(field) || field.type !== "select") {
    return false;
  }

  return field.options.some((option) => normalizePrice(field.option_prices?.[option]) !== null);
}

export function getRouteSelectionField(customFields: CustomField[]): (CustomField & { options: string[] }) | null {
  const selectFields = customFields.filter(hasOptions).filter((field) => field.type === "select");
  const preferredField = selectFields.find((field) => ROUTE_FIELD_KEYS.has(field.key));

  return preferredField || selectFields[0] || null;
}

export function getPricingField(customFields: CustomField[]): (CustomField & { options: string[] }) | null {
  const pricedFields = customFields.filter(isPricedSelectField);
  const preferredField = pricedFields.find((field) => ROUTE_FIELD_KEYS.has(field.key));

  return preferredField || pricedFields[0] || null;
}

export function getOptionPrice(
  field: CustomField | null | undefined,
  option: string | null | undefined,
): number | null {
  if (!field || !option) {
    return null;
  }

  return normalizePrice(field.option_prices?.[option]);
}

export function hasVariablePricing(customFields: CustomField[]): boolean {
  return !!getPricingField(customFields);
}

export function getStartingPrice(basePrice: number, customFields: CustomField[]): number {
  const pricingField = getPricingField(customFields);

  if (!pricingField) {
    return basePrice;
  }

  const prices = pricingField.options
    .map((option) => getOptionPrice(pricingField, option))
    .filter((price): price is number => price !== null);

  return prices.length > 0 ? Math.min(...prices) : basePrice;
}

export function isOptionCoppia(
  field: CustomField | null | undefined,
  option: string | null | undefined,
): boolean {
  if (!field || !option) return false;
  return !!field.option_coppia?.[option];
}

export function hasCoppiaOptions(customFields: CustomField[]): boolean {
  const routeField = getRouteSelectionField(customFields);
  if (!routeField) return false;
  return routeField.options.some((opt) => isOptionCoppia(routeField, opt));
}

export function getSelectedPrice(
  basePrice: number,
  customFields: CustomField[],
  selectedValues: Record<string, string | undefined>,
): number {
  const pricingField = getPricingField(customFields);

  if (!pricingField) {
    return basePrice;
  }

  const selectedOption = selectedValues[pricingField.key];
  const pricedValue = getOptionPrice(pricingField, selectedOption);

  return pricedValue ?? basePrice;
}

export function getOptionMaxSpots(
  field: CustomField | null | undefined,
  option: string | null | undefined,
): number | null {
  if (!field || !option) return null;
  const val = field.option_max_spots?.[option];
  return typeof val === "number" ? val : null;
}

export function optionRequiresCertificate(
  field: CustomField | null | undefined,
  option: string | null | undefined,
): boolean {
  if (!field || !option) return false;
  return !!field.option_requires_certificate?.[option];
}

export function hasMaxSpotsOptions(customFields: CustomField[]): boolean {
  const routeField = getRouteSelectionField(customFields);
  if (!routeField || !hasOptions(routeField)) return false;
  return routeField.options.some((opt) => getOptionMaxSpots(routeField, opt) !== null);
}
