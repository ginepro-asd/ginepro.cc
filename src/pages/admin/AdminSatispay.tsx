import { useEffect, useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const AdminSatispay = () => {
  const { adminPassword } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!adminPassword) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("manage-event", {
        body: { password: adminPassword, action: "list" },
      });
      if (!error && data?.events) {
        setEvents(data.events.filter((e: any) => e.satispay_api_url || e.satispay_api_token));
      }
      setLoading(false);
    })();
  }, [adminPassword]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Satispay / Muvat</h1>
        <p className="text-sm text-muted-foreground">
          Configurazione gateway Satispay per evento. La gestione di account separati riassegnabili
          a più eventi è prevista in una prossima iterazione.
        </p>
      </div>
      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Nessun evento ha credenziali Satispay configurate.</CardContent></Card>
      ) : (
        events.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                {e.nome}
                {e.attivo ? <Badge variant="default">attivo</Badge> : <Badge variant="secondary">spento</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div><span className="text-muted-foreground">URL:</span> <span className="font-mono break-all">{e.satispay_api_url || "—"}</span></div>
              <div><span className="text-muted-foreground">Token:</span> <span className="font-mono">{e.satispay_api_token ? "••••••••" : "—"}</span></div>
              <p className="text-xs text-muted-foreground pt-2">
                Modifica le credenziali da <a href="/admin/events" className="text-primary hover:underline">Eventi → dettaglio evento</a>.
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default AdminSatispay;
