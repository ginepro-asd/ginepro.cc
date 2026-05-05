import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AdminCsvImport from "@/components/AdminCsvImport";

const AdminImports = () => {
  const { adminPassword } = useAdminAuth();
  const { toast } = useToast();
  const [loadingFs, setLoadingFs] = useState(false);
  const [fsEvents, setFsEvents] = useState<any[]>([]);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const loadFirestore = async () => {
    if (!adminPassword) return;
    setLoadingFs(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-firestore", {
        body: { password: adminPassword, action: "list" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setFsEvents(data.events || []);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setLoadingFs(false);
    }
  };

  const importEvent = async (firestoreId: string, name: string) => {
    if (!adminPassword) return;
    setImportingId(firestoreId);
    try {
      const { data, error } = await supabase.functions.invoke("import-firestore", {
        body: { password: adminPassword, firestore_event_id: firestoreId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast({ title: `Importato: ${data.event_name}`, description: `${data.participantsCreated} utenti, ${data.registrationsCreated} iscrizioni.` });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setImportingId(null);
    }
  };

  if (!adminPassword) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="font-display text-3xl font-bold">Import dati</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-4 w-4 text-primary" />
            Import da CSV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setCsvOpen(true)}>Apri import CSV</Button>
          <AdminCsvImport
            password={adminPassword}
            open={csvOpen}
            onOpenChange={setCsvOpen}
            onSuccess={() => setCsvOpen(false)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Import da Firestore
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={loadFirestore} disabled={loadingFs} variant="outline">
            {loadingFs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Lista eventi Firestore
          </Button>
          {fsEvents.length > 0 && (
            <div className="space-y-2">
              {fsEvents.map((e) => (
                <div key={e.firestore_id} className="flex items-center justify-between border border-border/40 rounded-lg p-3">
                  <span className="text-sm">{e.name}</span>
                  <Button
                    size="sm"
                    onClick={() => importEvent(e.firestore_id, e.name)}
                    disabled={importingId === e.firestore_id}
                  >
                    {importingId === e.firestore_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Importa"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminImports;
