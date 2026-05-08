import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SocietaCombobox from "@/components/SocietaCombobox";
import SocietaRequestActions from "@/components/admin/SocietaRequestActions";
import { Input } from "@/components/ui/input";

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const backState = location.state as { from?: string; label?: string } | null;
  const backHref = backState?.from || "/admin/users";
  const backLabel = backState?.label || "Torna agli utenti";
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<any>(null);
  const [societaNome, setSocietaNome] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [editingSocieta, setEditingSocieta] = useState(false);
  const [societaDraft, setSocietaDraft] = useState<{ id: string | null; nome: string | null }>({ id: null, nome: null });
  const [savingSocieta, setSavingSocieta] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    const { data: p } = await supabase.from("participants").select("*").eq("id", userId).maybeSingle();
    setParticipant(p);
    if (p?.societa_id) {
      const { data: s } = await supabase.from("societa").select("nome").eq("id", p.societa_id).maybeSingle();
      setSocietaNome(s?.nome || null);
      setSocietaDraft({ id: p.societa_id, nome: s?.nome || null });
    } else {
      setSocietaNome(null);
      setSocietaDraft({ id: null, nome: null });
    }
    const { data: regs } = await supabase
      .from("registrations")
      .select("id, payment_status, payment_method, created_at, custom_data, event_id, events:event_id(nome, slug)")
      .eq("participant_id", userId)
      .order("created_at", { ascending: false });
    setRegistrations(regs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [userId]);

  const saveSocieta = async () => {
    if (!userId) return;
    setSavingSocieta(true);
    try {
      const { error } = await supabase.from("participants").update({ societa_id: societaDraft.id }).eq("id", userId);
      if (error) throw error;
      setSocietaNome(societaDraft.nome);
      setEditingSocieta(false);
      toast({ title: "Società aggiornata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSavingSocieta(false);
    }
  };

  const saveEmail = async () => {
    if (!userId) return;
    const newEmail = emailDraft.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast({ title: "Email non valida", variant: "destructive" });
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.from("participants").update({ email: newEmail }).eq("id", userId);
      if (error) {
        if ((error as any).code === "23505") {
          toast({ title: "Email già in uso", description: "Questa email è associata a un altro partecipante.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }
      setParticipant({ ...participant, email: newEmail });
      setEditingEmail(false);
      toast({ title: "Email aggiornata" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!participant) return <p>Utente non trovato.</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button asChild variant="ghost" size="sm">
        <Link to={backHref}><ArrowLeft className="h-4 w-4 mr-1" />{backLabel}</Link>
      </Button>
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold">{participant.nome} {participant.cognome}</h1>
        {!editingEmail ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-muted-foreground">{participant.email} · {participant.telefono}</p>
            <Button variant="ghost" size="sm" onClick={() => { setEmailDraft(participant.email || ""); setEditingEmail(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica email
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap max-w-md">
            <Input type="email" value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} className="flex-1 min-w-[220px]" />
            <Button size="sm" onClick={saveEmail} disabled={savingEmail}>
              {savingEmail && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salva
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingEmail(false)}>Annulla</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dati anagrafici</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Codice fiscale:</span> <span className="font-mono">{participant.codice_fiscale || "—"}</span></div>
          <div><span className="text-muted-foreground">Data nascita:</span> {participant.birth_date || "—"}</div>
          <div><span className="text-muted-foreground">Luogo nascita:</span> {participant.birth_place || "—"}</div>
          <div><span className="text-muted-foreground">Newsletter:</span> {participant.newsletter ? "Sì" : "No"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Società</CardTitle>
          {!editingSocieta && (
            <Button variant="ghost" size="sm" onClick={() => setEditingSocieta(true)}>
              <Pencil className="h-4 w-4 mr-1" /> {societaNome ? "Modifica" : "Aggiungi"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!editingSocieta ? (
            <p className="text-sm">
              {societaNome ? <span className="font-medium">{societaNome}</span> : <span className="text-muted-foreground">Nessuna società associata</span>}
            </p>
          ) : (
            <div className="space-y-2">
              <SocietaCombobox value={societaDraft} onChange={setSocietaDraft} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveSocieta} disabled={savingSocieta}>
                  {savingSocieta && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salva
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditingSocieta(false); setSocietaDraft({ id: participant.societa_id || null, nome: societaNome }); }}>Annulla</Button>
              </div>
            </div>
          )}
          {!editingSocieta && (
            <div className="flex flex-wrap gap-2 pt-1">
              <SocietaRequestActions participant={participant} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Iscrizioni ({registrations.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {registrations.length === 0 && <p className="text-sm text-muted-foreground">Nessuna iscrizione.</p>}
          {registrations.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 border border-border/40 rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.events?.nome || "—"}</p>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("it-IT")} · {r.payment_method}</p>
              </div>
              <Badge variant={r.payment_status === "completed" ? "default" : r.payment_status === "pending" ? "secondary" : "destructive"}>
                {r.payment_status}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserDetail;
