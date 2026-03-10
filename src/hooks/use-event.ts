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
  is_coppia: boolean;
  pettorale_start: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
}

export interface CustomField {
  key: string;
  label: string;
  type: "text" | "select" | "file" | "checkbox" | "number";
  required?: boolean;
  options?: string[];
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
        is_coppia: (data as any).is_coppia ?? false,
        pettorale_start: (data as any).pettorale_start ?? null,
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
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("attivo", true)
        .order("data_evento", { ascending: true });
      if (error) throw error;
      return (data || []).map((e) => ({
        ...e,
        custom_fields: (e.custom_fields as unknown as CustomField[]) || [],
        payment_methods: e.payment_methods || ["stripe", "satispay", "paypal"],
        is_tesseramento: e.is_tesseramento ?? false,
        is_coppia: (e as any).is_coppia ?? false,
        pettorale_start: (e as any).pettorale_start ?? null,
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
        .select("id, nome, slug, data_evento, luogo, descrizione, is_tesseramento")
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
