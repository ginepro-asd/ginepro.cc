import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, FileCheck, Download, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const AdminCertificates = () => {
  const [loading, setLoading] = useState(true);
  const [certs, setCerts] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("medical_certificates")
        .select("id, file_path, expiry_date, disciplines, ai_warning, uploaded_at, participant_id, participants:participant_id(nome, cognome, email)")
        .order("uploaded_at", { ascending: false })
        .limit(500);
      setCerts(data || []);
      setLoading(false);
    })();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const status = (exp: string | null) => {
    if (!exp) return { label: "—", variant: "secondary" as const };
    if (exp < today) return { label: "scaduto", variant: "destructive" as const };
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    if (exp < in30.toISOString().slice(0, 10)) return { label: "in scadenza", variant: "secondary" as const };
    return { label: "valido", variant: "default" as const };
  };

  const open = (path: string) => {
    const { data } = supabase.storage.from("medical-certificates").getPublicUrl(path);
    window.open(data.publicUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <FileCheck className="h-7 w-7 text-primary" />
          Certificati medici
        </h1>
        <p className="text-sm text-muted-foreground">{certs.length} certificati caricati</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partecipante</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Discipline</TableHead>
                  <TableHead>Caricato</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certs.map((c) => {
                  const st = status(c.expiry_date);
                  const p = c.participants;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        {p ? (
                          <Link to={`/admin/users/${c.participant_id}`} className="text-primary hover:underline">
                            {p.nome} {p.cognome}
                          </Link>
                        ) : "—"}
                      </TableCell>
                      <TableCell>{c.expiry_date || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {c.ai_warning && <AlertTriangle className="inline h-3.5 w-3.5 ml-1.5 text-amber-500" />}
                      </TableCell>
                      <TableCell className="text-xs">{(c.disciplines || []).join(", ") || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.uploaded_at).toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => open(c.file_path)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCertificates;
