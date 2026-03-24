import { resolveEventPrice } from "./event-pricing.ts";

type PricingField = {
  key?: unknown;
  type?: unknown;
  options?: unknown;
  option_prices?: Record<string, unknown> | null;
  option_max_spots?: Record<string, unknown> | null;
  option_requires_certificate?: Record<string, unknown> | null;
};

const ROUTE_FIELD_KEYS = new Set(["disciplina", "percorso", "route", "distance"]);

function asPricingFields(customFields: unknown): PricingField[] {
  if (!Array.isArray(customFields)) return [];
  return customFields.filter(
    (f): f is PricingField => !!f && typeof f === "object" && !Array.isArray(f),
  );
}

function hasSelectOptions(field: PricingField): field is PricingField & { key: string; options: string[] } {
  return (
    typeof field.key === "string" &&
    field.type === "select" &&
    Array.isArray(field.options) &&
    field.options.length > 0
  );
}

function getRouteField(customFields: unknown) {
  const fields = asPricingFields(customFields).filter(hasSelectOptions);
  return fields.find((f) => ROUTE_FIELD_KEYS.has(f.key)) || fields[0] || null;
}

export async function validateSpotsAndCertificate(
  supabaseAdmin: any,
  event: { id: string; custom_fields: unknown },
  customData: Record<string, unknown>,
  certificatePaths?: string[],
) {
  const routeField = getRouteField(event.custom_fields);
  if (!routeField) return;

  const selectedOption = customData[routeField.key] as string | undefined;
  if (!selectedOption) return;

  // Check spots
  const maxSpots = routeField.option_max_spots?.[selectedOption];
  if (typeof maxSpots === "number") {
    const { count, error } = await supabaseAdmin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("payment_status", "completed")
      .contains("custom_data", { [routeField.key]: selectedOption });

    if (!error && typeof count === "number" && count >= maxSpots) {
      throw new Error(`Posti esauriti per "${selectedOption}"`);
    }
  }

  // Check certificate requirement
  const requiresCert = !!routeField.option_requires_certificate?.[selectedOption];
  if (requiresCert) {
    const hasTessera = typeof customData.tessera_sportiva === "string" && customData.tessera_sportiva.trim().length > 0;
    if (!hasTessera && (!certificatePaths || certificatePaths.length === 0)) {
      throw new Error("Certificato medico obbligatorio senza tessera sportiva");
    }
  }
}
