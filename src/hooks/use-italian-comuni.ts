import { useState, useEffect } from "react";

let cachedComuni: string[] | null = null;

export function useItalianComuni() {
  const [comuni, setComuni] = useState<string[]>(cachedComuni || []);
  const [loading, setLoading] = useState(!cachedComuni);

  useEffect(() => {
    if (cachedComuni) return;

    fetch("https://comuni-ita.nicolorebaioli.dev/comuni")
      .then((res) => res.json())
      .then((data: Array<{ nome: string; provincia: { sigla: string } }>) => {
        const names = data.map((c) => `${c.nome} (${c.provincia.sigla})`).sort();
        cachedComuni = names;
        setComuni(names);
      })
      .catch((err) => {
        console.error("Failed to fetch comuni:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  return { comuni, loading };
}
