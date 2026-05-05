import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ParticipantRow {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  codice_fiscale: string | null;
  reg_count: number;
}

const AdminUsers = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: parts } = await supabase
        .from("participants")
        .select("id, nome, cognome, email, telefono, codice_fiscale")
        .order("created_at", { ascending: false })
        .limit(1000);
      // Fetch all registration participant_ids (paginated to bypass 1000 row default limit)
      const regs: { participant_id: string | null }[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("registrations")
          .select("participant_id")
          .not("participant_id", "is", null)
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        regs.push(...data);
        if (data.length < pageSize) break;
      }
      const counts: Record<string, number> = {};
      (regs || []).forEach((r) => {
        if (r.participant_id) counts[r.participant_id] = (counts[r.participant_id] || 0) + 1;
      });
      setRows((parts || []).map((p) => ({ ...p, reg_count: counts[p.id] || 0 })));
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [r.nome, r.cognome, r.email, r.telefono, r.codice_fiscale]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Utenti</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} di {rows.length} partecipanti</p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca nome, email, CF..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefono</TableHead>
                  <TableHead>CF</TableHead>
                  <TableHead className="text-right">Iscrizioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/admin/users/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.nome} {r.cognome}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.telefono}</TableCell>
                    <TableCell className="text-sm font-mono text-xs">{r.codice_fiscale || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={r.reg_count > 0 ? "default" : "secondary"}>{r.reg_count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsers;
