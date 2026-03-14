import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventData {
  id: string;
  slug: string;
  nome: string;
  descrizione: string | null;
  data_evento: string | null;
  luogo: string | null;
  prezzo: number;
  custom_fields: CustomField[];
  scadenza_iscrizioni: string | null;
  attivo: boolean;
  hero_image: string | null;
  payment_methods: string[];
  is_tesseramento: boolean;
  visibile_in_landing: boolean;
  is_coppia: boolean;
  pettorale_start: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  external_url: string | null;
  regulation_url: string | null;
}

export interface CustomField {
  key: string;
  label: string;
  type: "text" | "select" | "file" | "checkbox" | "number";
  required?: boolean;
  options?: string[];
  option_prices?: Record<string, number | string>;
  placeholder?: string;
}

export function useEvent(slug: string | undefined) {
  return useQuery({
    queryKey: ["event", slug],
    queryFn: async (): Promise<EventData> => {
      if (!slug) throw new Error("No slug provided");
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .eq("attivo", true)
        .single();
      if (error) throw error;
      return {
        ...data,
        custom_fields: (data.custom_fields as unknown as CustomField[]) || [],
        payment_methods: data.payment_methods || ["stripe", "satispay", "paypal"],
        is_tesseramento: data.is_tesseramento ?? false,
        visibile_in_landing: (data as any).visibile_in_landing ?? true,
        is_coppia: (data as any).is_coppia ?? false,
        pettorale_start: (data as any).pettorale_start ?? null,
        location_lat: (data as any).location_lat ?? null,
        location_lng: (data as any).location_lng ?? null,
        location_label: (data as any).location_label ?? null,
        external_url: (data as any).external_url ?? null,
        regulation_url: (data as any).regulation_url ?? null,
      };
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async (): Promise<EventData[]> => {
      const query = supabase
        .from("events")
        .select("*") as any;
      const { data, error } = await query
        .eq("attivo", true)
        .eq("visibile_in_landing", true)
        .order("data_evento", { ascending: true });
      if (error) throw error;
      return (data || []).map((e: any) => ({
        id: e.id,
        slug: e.slug,
        nome: e.nome,
        descrizione: e.descrizione,
        data_evento: e.data_evento,
        luogo: e.luogo,
        prezzo: e.prezzo,
        custom_fields: (e.custom_fields as CustomField[]) || [],
        scadenza_iscrizioni: e.scadenza_iscrizioni,
        attivo: e.attivo,
        hero_image: e.hero_image,
        payment_methods: e.payment_methods || ["stripe", "satispay", "paypal"],
        is_tesseramento: e.is_tesseramento ?? false,
        visibile_in_landing: e.visibile_in_landing ?? true,
        is_coppia: e.is_coppia ?? false,
        pettorale_start: e.pettorale_start ?? null,
        location_lat: e.location_lat ?? null,
        location_lng: e.location_lng ?? null,
        location_label: e.location_label ?? null,
        external_url: (e as any).external_url ?? null,
        regulation_url: (e as any).regulation_url ?? null,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface PastEventData {
  id: string;
  nome: string;
  slug: string;
  data_evento: string | null;
  luogo: string | null;
  location_label: string | null;
  descrizione: string | null;
  is_tesseramento: boolean;
  registration_count: number;
}

export function usePastEvents() {
  return useQuery({
    queryKey: ["past-events"],
    queryFn: async (): Promise<PastEventData[]> => {
      // Fetch inactive events
      const { data: events, error } = await supabase
        .from("events")
        .select("id, nome, slug, data_evento, luogo, location_label, descrizione, is_tesseramento")
        .eq("attivo", false)
        .order("data_evento", { ascending: false });
      if (error) throw error;
      if (!events || events.length === 0) return [];

      // Fetch registration counts per event
      const eventIds = events.map((e) => e.id);
      const { data: regs, error: regError } = await supabase
        .from("registrations")
        .select("event_id")
        .in("event_id", eventIds);
      
      const counts: Record<string, number> = {};
      if (!regError && regs) {
        for (const r of regs) {
          if (r.event_id) counts[r.event_id] = (counts[r.event_id] || 0) + 1;
        }
      }

      return events.map((e) => ({
        ...e,
        is_tesseramento: e.is_tesseramento ?? false,
        registration_count: counts[e.id] || 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + "€";
}
