import { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Smartphone, Plus, Trash2, Pencil, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface SatispayAccount {
  id: string;
  nome: string;
  api_url: string;
  api_token: string;
  is_default: boolean;
  note: string | null;
}

const empty = (): Partial<SatispayAccount> => ({
  nome: "", api_url: "", api_token: "", is_default: false, note: "",
});

const AdminSatispay = () => {
  const { adminPassword } = useAdminAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<SatispayAccount[]>([]);
  const [editing, setEditing] = useState<Partial<SatispayAccount> | null>(null);
  const [saving, setSaving] = useState(false);
  const [eventsByAccount, setEventsByAccount] = useState<Record<string, string[]>>({});

  const load = async () => {
    if (!adminPassword) return;
    setLoading(true);
    const { data } = await supabase.functions.invoke("manage-event", {
      body: { password: adminPassword, action: "list_satispay_accounts" },
    });
    if (data?.accounts) setAccounts(data.accounts);

    const { data: evts } = await supabase
      .from("events")
      .select("nome, satispay_account_id")
      .not("satispay_account_id", "is", null);
    const byAcc: Record<string, string[]> = {};
    (evts || []).forEach((e: any) => {
      (byAcc[e.satispay_account_id] ||= []).push(e.nome);
    });
    setEventsByAccount(byAcc);
    setLoading(false);
  };

  useEffect(() => { load(); }, [adminPassword]);

  const save = async () => {
    if (!editing?.nome || !editing?.api_url || !editing?.api_token) {
      toast({ title: "Campi obbligatori", description: "Nome, URL e token", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("manage-event", {
      body: { password: adminPassword, action: "upsert_satispay_account", account: editing },
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: "Errore", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: editing.id ? "Account aggiornato" : "Account creato" });
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("manage-event", {
      body: { password: adminPassword, action: "delete_satispay_account", account_id: id },
    });
    if (error || data?.error) {
      toast({ title: "Errore", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Account eliminato" });
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Account Satispay</h1>
          <p className="text-sm text-muted-foreground">
            Gestisci le credenziali Muvat/Satispay e assegnale agli eventi.
          </p>
        </div>
        <Button onClick={() => setEditing(empty())}>
          <Plus className="h-4 w-4 mr-2" /> Nuovo account
        </Button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : accounts.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Nessun account configurato.</CardContent></Card>
      ) : (
        accounts.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <Smartphone className="h-4 w-4 text-primary" />
                {a.nome}
                {a.is_default && <Badge variant="default" className="gap-1"><Star className="h-3 w-3" /> default</Badge>}
              </CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminare l'account?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Gli eventi collegati torneranno ad usare l'account predefinito.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(a.id)}>Elimina</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><span className="text-muted-foreground">URL:</span> <span className="font-mono break-all text-xs">{a.api_url}</span></div>
              <div><span className="text-muted-foreground">Token:</span> <span className="font-mono">••••••••</span></div>
              {a.note && <div className="text-muted-foreground italic text-xs">{a.note}</div>}
              <div className="pt-2">
                <span className="text-muted-foreground text-xs">Eventi collegati: </span>
                {eventsByAccount[a.id]?.length
                  ? eventsByAccount[a.id].map((n) => <Badge key={n} variant="secondary" className="mr-1">{n}</Badge>)
                  : <span className="text-xs text-muted-foreground">{a.is_default ? "tutti gli eventi senza account specifico" : "nessuno"}</span>}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifica account" : "Nuovo account Satispay"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Nome *</Label>
                <Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">API URL *</Label>
                <Input value={editing.api_url || ""} placeholder="https://muvat-api..."
                  autoComplete="off" data-1p-ignore data-lpignore="true"
                  onChange={(e) => setEditing({ ...editing, api_url: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Bearer Token *</Label>
                <Input type="password" value={editing.api_token || ""}
                  autoComplete="off" data-1p-ignore data-lpignore="true"
                  onChange={(e) => setEditing({ ...editing, api_token: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Note</Label>
                <Textarea rows={2} value={editing.note || ""}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={!!editing.is_default}
                  onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
                <Label className="text-sm">Account predefinito</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annulla</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSatispay;
