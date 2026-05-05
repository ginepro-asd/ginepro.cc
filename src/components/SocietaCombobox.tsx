import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSocieta } from "@/hooks/use-societa";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface SocietaComboboxProps {
  value: { id: string | null; nome: string | null };
  onChange: (v: { id: string | null; nome: string | null }) => void;
  placeholder?: string;
}

const SocietaCombobox = ({ value, onChange, placeholder = "Seleziona società..." }: SocietaComboboxProps) => {
  const { data: societa = [], isLoading } = useSocieta();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const filtered = useMemo(() => {
    if (!search) return societa.slice(0, 100);
    const lower = search.toLowerCase().trim();
    return societa.filter((s) => s.nome.toLowerCase().includes(lower)).slice(0, 100);
  }, [societa, search]);

  const exactMatch = useMemo(
    () => societa.some((s) => s.nome.toLowerCase() === search.toLowerCase().trim()),
    [societa, search],
  );

  const handleCreate = async () => {
    const nome = search.trim();
    if (nome.length < 2) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-societa", { body: { nome } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const s = data.societa;
      await qc.invalidateQueries({ queryKey: ["societa"] });
      onChange({ id: s.id, nome: s.nome });
      setOpen(false);
      setSearch("");
      toast({ title: data.existed ? "Società già esistente" : "Società creata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open}
          className="w-full justify-between font-normal h-10">
          <span className={cn("truncate", !value.nome && "text-muted-foreground")}>
            {value.nome || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Cerca società..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim().length >= 2 ? (
                <Button size="sm" variant="ghost" disabled={creating} onClick={handleCreate}
                  className="w-full justify-start">
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Aggiungi "{search.trim()}"
                </Button>
              ) : isLoading ? "Caricamento..." : "Inizia a digitare per cercare o aggiungere"}
            </CommandEmpty>
            {value.id && (
              <CommandGroup>
                <CommandItem onSelect={() => { onChange({ id: null, nome: null }); setOpen(false); }}>
                  <span className="text-muted-foreground">— Nessuna società —</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filtered.map((s) => (
                <CommandItem key={s.id} value={s.nome}
                  onSelect={() => { onChange({ id: s.id, nome: s.nome }); setOpen(false); setSearch(""); }}>
                  <Check className={cn("mr-2 h-4 w-4", value.id === s.id ? "opacity-100" : "opacity-0")} />
                  {s.nome}
                </CommandItem>
              ))}
              {search.trim().length >= 2 && !exactMatch && filtered.length > 0 && (
                <CommandItem onSelect={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Aggiungi "{search.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SocietaCombobox;
