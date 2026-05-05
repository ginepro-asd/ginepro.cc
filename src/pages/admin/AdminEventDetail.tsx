import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import EventForm from "@/components/admin/EventForm";

const AdminEventDetail = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { adminPassword } = useAdminAuth();
  const { toast } = useToast();
  const isNew = eventId === "new";
  const [event, setEvent] = useState<any | null>(null);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!adminPassword || isNew) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("manage-event", {
          body: { password: adminPassword, action: "list" },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        const ev = (data.events || []).find((e: any) => e.id === eventId);
        if (!ev) throw new Error("Evento non trovato");
        setEvent(ev);
      } catch (err: any) {
        toast({ title: "Errore", description: err.message, variant: "destructive" });
      } finally { setLoading(false); }
    })();
  }, [adminPassword, eventId, isNew]);

  if (!adminPassword) return null;
  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/events"><ArrowLeft className="h-4 w-4 mr-1" /> Eventi</Link>
          </Button>
          <h2 className="font-display text-xl font-bold">
            {isNew ? "Nuovo evento" : event?.nome}
          </h2>
        </div>
        {!isNew && event && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/admin/events/${event.id}/participants`}>
              <Users className="h-4 w-4 mr-2" /> Iscritti
            </Link>
          </Button>
        )}
      </div>
      <EventForm password={adminPassword} event={event} creating={isNew} />
    </div>
  );
};

export default AdminEventDetail;
