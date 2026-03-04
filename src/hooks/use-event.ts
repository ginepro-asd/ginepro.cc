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
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + "€";
}
