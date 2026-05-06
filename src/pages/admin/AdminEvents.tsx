import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, Users, MapPin, Calendar, Eye, EyeOff } from "lucide-react";
import { formatPrice } from "@/hooks/use-event";
import { getStartingPrice, hasVariablePricing } from "@/lib/event-pricing";

const normalize = (cf: unknown): any[] => Array.isArray(cf) ? cf : [];

const AdminEvents = () => {
  const { adminPassword } = useAdminAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEvents = async () => {
    if (!adminPassword) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-event", {
        body: { password: adminPassword, action: "list" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setEvents(data.events || []);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchEvents(); }, [adminPassword]);

  const executeDelete = async () => {
    if (!deleteEvent) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-event", {
        body: { password: adminPassword, action: "delete", event_id: deleteEvent.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast({ title: "Evento eliminato" });
      setDeleteEvent(null);
      fetchEvents();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally { setDeleting(false); }
  };

  if (!adminPassword) return null;

  if (loading && events.length === 0) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Gestione Eventi</h2>
        <Button onClick={() => navigate("/admin/events/new")}>
          <Plus className="h-4 w-4 mr-2" /> Nuovo evento
        </Button>
      </div>

      {(() => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const upcoming = events
          .filter((e) => e.data_evento && new Date(e.data_evento) >= today)
          .sort((a, b) => +new Date(a.data_evento) - +new Date(b.data_evento));
        const past = events
          .filter((e) => e.data_evento && new Date(e.data_evento) < today)
          .sort((a, b) => +new Date(b.data_evento) - +new Date(a.data_evento));
        const undated = events.filter((e) => !e.data_evento);
        const ordered = upcoming;
        const pastAll = [...past, ...undated];

        const renderCard = (ev: any) => (
          <Card key={ev.id} className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <Link to={`/admin/events/${ev.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-display font-bold text-foreground truncate">{ev.nome}</span>
                  <Badge variant={ev.attivo ? "default" : "secondary"} className="shrink-0">
                    {ev.attivo ? "Attivo" : "Inattivo"}
                  </Badge>
                  {ev.is_coppia && <Badge variant="outline" className="shrink-0">Coppia</Badge>}
                  {ev.is_tesseramento && <Badge variant="outline" className="shrink-0">Tesseramento</Badge>}
                  <Badge variant="outline" className="shrink-0 gap-1">
                    {ev.visibile_in_landing
                      ? <><Eye className="h-3 w-3" /> Landing visibile</>
                      : <><EyeOff className="h-3 w-3" /> Landing nascosta</>}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>/{ev.slug}</span>
                  {ev.data_evento && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(ev.data_evento).toLocaleDateString("it-IT")}
                    </span>
                  )}
                  {ev.location_label && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {ev.location_label}
                    </span>
                  )}
                  <span>
                    {hasVariablePricing(normalize(ev.custom_fields))
                      ? `da ${formatPrice(getStartingPrice(ev.prezzo, normalize(ev.custom_fields)))}`
                      : formatPrice(ev.prezzo)}
                  </span>
                </div>
              </Link>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" title="Iscritti"
                  onClick={() => navigate(`/admin/events/${ev.id}/participants`)}>
                  <Users className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Modifica"
                  onClick={() => navigate(`/admin/events/${ev.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Elimina"
                  onClick={() => setDeleteEvent(ev)}
                  className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );

        return (
          <>
            <div className="grid gap-3">{ordered.map(renderCard)}</div>
            {pastAll.length > 0 && (
              <div className="space-y-3 pt-6">
                <h3 className="font-display text-sm font-bold text-muted-foreground uppercase tracking-wide">
                  Eventi passati
                </h3>
                <div className="grid gap-3 opacity-70">{pastAll.map(renderCard)}</div>
              </div>
            )}
          </>
        );
      })()}

      <AlertDialog open={!!deleteEvent} onOpenChange={(open) => { if (!open) setDeleteEvent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina evento</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare "{deleteEvent?.nome}"? L'evento può essere eliminato solo se non ha iscrizioni collegate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminEvents;
