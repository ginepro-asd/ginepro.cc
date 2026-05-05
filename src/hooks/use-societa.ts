import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Societa {
  id: string;
  nome: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function useSocieta() {
  return useQuery({
    queryKey: ["societa"],
    queryFn: async (): Promise<Societa[]> => {
      const { data, error } = await supabase
        .from("societa")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });
}
