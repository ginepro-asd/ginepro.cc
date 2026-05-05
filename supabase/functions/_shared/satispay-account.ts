// Resolve Satispay credentials for an event.
// Priority:
//   1. event.satispay_account_id → satispay_accounts row
//   2. legacy event.satispay_api_url / satispay_api_token (transitional fallback)
//   3. default satispay_accounts row (is_default = true)
//   4. hardcoded SATISPAY_BASE_DEFAULT + SATISPAY_MUVAT_TOKEN env

const SATISPAY_BASE_DEFAULT = "https://muvat-api-304633219729.europe-west1.run.app/payment/77jc79juc3ftimn93si6irl7k32f1n4sarj58oaugdn882rrqjn909m103nrc4ni634q61996p2cd6kilnor1qekraul4go906nlsfn6rse5thlf72oid48rki1fdqvm3qdkp6kjild2jgasolb2o0088op20a11od4kjtmtr4eu9hbfdtlj3poornpt7m9cvgmcqrd8";
const SATISPAY_TOKEN_DEFAULT = Deno.env.get("SATISPAY_MUVAT_TOKEN") || "";

export interface SatispayCreds {
  apiUrl: string;
  apiToken: string;
}

export async function resolveSatispayCreds(
  supabase: any,
  eventId: string | null | undefined,
): Promise<SatispayCreds> {
  let event: any = null;
  if (eventId) {
    const { data } = await supabase
      .from("events")
      .select("satispay_account_id, satispay_api_url, satispay_api_token")
      .eq("id", eventId)
      .single();
    event = data;
  }

  if (event?.satispay_account_id) {
    const { data: acc } = await supabase
      .from("satispay_accounts")
      .select("api_url, api_token")
      .eq("id", event.satispay_account_id)
      .single();
    if (acc?.api_url && acc?.api_token) {
      return { apiUrl: acc.api_url, apiToken: acc.api_token };
    }
  }

  if (event?.satispay_api_url && event?.satispay_api_token) {
    return { apiUrl: event.satispay_api_url, apiToken: event.satispay_api_token };
  }

  const { data: def } = await supabase
    .from("satispay_accounts")
    .select("api_url, api_token")
    .eq("is_default", true)
    .maybeSingle();
  if (def?.api_url && def?.api_token) {
    return { apiUrl: def.api_url, apiToken: def.api_token };
  }

  return { apiUrl: SATISPAY_BASE_DEFAULT, apiToken: SATISPAY_TOKEN_DEFAULT };
}
