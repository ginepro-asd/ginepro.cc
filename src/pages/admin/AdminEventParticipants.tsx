import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Download, Search, Pencil, UserPlus, Trash2 } from "lucide-react";
import AdminAddRegistration from "@/components/AdminAddRegistration";
import type { CustomField } from "@/hooks/use-event";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const AdminEventParticipants = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { adminPassword } = useAdminAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [eventName, setEventName] = useState("");
  const [eventCustomFields, setEventCustomFields] = useState<CustomField[]>([]);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!adminPassword || !eventId) return;
    (async () => {
      setLoading(true);
      try {
        const [{ data, error }, evRes] = await Promise.all([
          supabase.functions.invoke("export-registrations", {
            body: { password: adminPassword, format: "json", event_id: eventId },
          }),
          supabase.from("events").select("nome, custom_fields").eq("id", eventId).maybeSingle(),
        ]);
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setRegistrations(data.registrations || []);
        setEventName(evRes.data?.nome || data.registrations?.[0]?.event_nome || "");
        setEventCustomFields(((evRes.data?.custom_fields as unknown) as CustomField[]) || []);
      } catch (err: any) {
        toast({ title: "Errore", description: err.message, variant: "destructive" });
      } finally { setLoading(false); }
    })();
  }, [adminPassword, eventId, reloadKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return registrations;
    return registrations.filter((r) =>
      [r.nome, r.cognome, r.email, r.telefono, r.codice_fiscale]
        .filter(Boolean).some((v: string) => v.toLowerCase().includes(q)),
    );
  }, [registrations, query]);

  const exportCsv = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("export-registrations", {
        body: { password: adminPassword, format: "csv", event_id: eventId },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `iscritti-${eventName || eventId}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Errore export", description: err.message, variant: "destructive" });
    }
  };

  if (!adminPassword) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/events/${eventId}`}><ArrowLeft className="h-4 w-4 mr-1" /> Evento</Link>
          </Button>
          <div>
            <h2 className="font-display text-xl font-bold">Iscritti{eventName ? ` — ${eventName}` : ""}</h2>
            <p className="text-xs text-muted-foreground">{registrations.length} iscrizioni totali</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" /> Aggiungi iscritto
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || registrations.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Esporta CSV
          </Button>
        </div>
      </div>


      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Cerca per nome, email, telefono, CF..."
          value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">Nessun iscritto.</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((r) => (
            <Card key={r.id} className="border-border/50">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{r.nome} {r.cognome}</span>
                    <Badge variant={r.payment_status === "paid" ? "default" : r.payment_status === "pending" ? "secondary" : "destructive"} className="text-xs">
                      {r.payment_status}
                    </Badge>
                    {r.payment_method && <Badge variant="outline" className="text-xs">{r.payment_method}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                    {r.email && <span>{r.email}</span>}
                    {r.telefono && <span>{r.telefono}</span>}
                    {r.codice_fiscale && <span>{r.codice_fiscale}</span>}
                  </div>
                </div>
                {r.participant_id && (
                  <Button size="icon" variant="ghost" asChild title="Apri utente">
                    <Link to={`/admin/users/${r.participant_id}`}><Pencil className="h-4 w-4" /></Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {eventId && (
        <AdminAddRegistration
          open={addOpen}
          onOpenChange={setAddOpen}
          eventId={eventId}
          eventCustomFields={eventCustomFields}
          password={adminPassword || ""}
          onSuccess={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default AdminEventParticipants;
