import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AdminUserDetail = () => {
  const { userId } = useParams<{ userId: string }>();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from("participants").select("*").eq("id", userId).maybeSingle();
      setParticipant(p);
      const { data: regs } = await supabase
        .from("registrations")
        .select("id, payment_status, payment_method, created_at, custom_data, event_id, events:event_id(nome, slug)")
        .eq("participant_id", userId)
        .order("created_at", { ascending: false });
      setRegistrations(regs || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!participant) return <p>Utente non trovato.</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" />Torna agli utenti</Link>
      </Button>
      <div>
        <h1 className="font-display text-3xl font-bold">{participant.nome} {participant.cognome}</h1>
        <p className="text-muted-foreground">{participant.email} · {participant.telefono}</p>
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
