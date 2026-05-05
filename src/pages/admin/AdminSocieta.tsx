import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSocieta } from "@/hooks/use-societa";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

const AdminSocieta = () => {
  const { data: list = [], isLoading } = useSocieta();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id?: string; nome: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter((s) => s.nome.toLowerCase().includes(q) || (s.note || "").toLowerCase().includes(q));
  }, [list, search]);

  const save = async () => {
    if (!editing) return;
    const nome = editing.nome.trim();
    if (nome.length < 2) {
      toast({ title: "Nome troppo corto", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        const { error } = await supabase.from("societa").update({ nome, note: editing.note || null }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("societa").insert({ nome, note: editing.note || null });
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["societa"] });
      toast({ title: editing.id ? "Aggiornata" : "Creata" });
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, nome: string) => {
    if (!confirm(`Eliminare "${nome}"?`)) return;
    const { error } = await supabase.from("societa").delete().eq("id", id);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["societa"] });
    toast({ title: "Eliminata" });
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Società</h1>
        <Button size="sm" onClick={() => setEditing({ nome: "", note: "" })}>
          <Plus className="h-4 w-4 mr-1" /> Nuova
        </Button>
      </div>

      <Input placeholder="Cerca…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border/40">
              {filtered.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground text-center">Nessuna società.</p>
              )}
              {filtered.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.nome}</p>
                    {s.note && <p className="text-xs text-muted-foreground truncate">{s.note}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing({ id: s.id, nome: s.nome, note: s.note || "" })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(s.id, s.nome)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifica società" : "Nuova società"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Nome *</Label>
                <Input value={editing.nome} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Note</Label>
                <Textarea value={editing.note} rows={3} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSocieta;
