import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Download, FileSpreadsheet, Loader2, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import logoDark from "@/assets/icon-mountain.png";

interface Registration {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
}

const Admin = () => {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const authenticate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-registrations", {
        body: { password, format: "json" },
      });

      if (error) throw error;
      if (data.error) {
        toast({ title: "Errore", description: data.error, variant: "destructive" });
        return;
      }

      setRegistrations(data.registrations || []);
      setAuthenticated(true);
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Password non valida",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-registrations", {
        body: { password, format: "csv" },
      });

      if (error) throw error;

      // data is the CSV string
      const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iscrizioni_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: "Download avviato", description: "Il file CSV è stato scaricato." });
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Errore durante il download.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "paid") return "default";
    if (status === "pending") return "secondary";
    return "destructive";
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-sm w-full border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <img src={logoDark} alt="GINEPRO" className="h-10 mx-auto mb-2 object-contain" />
            <CardTitle className="font-display text-xl flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" />
              Area Admin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && authenticate()}
                  placeholder="Inserisci la password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button onClick={authenticate} disabled={loading || !password} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accedi
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link to="/">← Torna alla home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src={logoDark} alt="GINEPRO" className="h-8 object-contain" />
            <h1 className="font-display text-2xl font-bold text-foreground">Iscrizioni</h1>
            <Badge variant="outline">{registrations.length} totali</Badge>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadCSV} disabled={loading} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Scarica CSV
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Home</Link>
            </Button>
          </div>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nessuna iscrizione trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    registrations.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.nome} {r.cognome}</TableCell>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>{r.telefono}</TableCell>
                        <TableCell className="capitalize">{r.payment_method}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(r.payment_status)}>
                            {r.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(r.created_at).toLocaleDateString("it-IT", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
