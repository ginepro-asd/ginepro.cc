import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Download, FileSpreadsheet, Loader2, Eye, EyeOff, CalendarDays } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import logoDark from "@/assets/icon-mountain.png";
import { useEvent } from "@/hooks/use-event";

interface EventRegistration {
  id: string;
  event_id: string;
  event_nome: string;
  event_slug: string;
  payment_method: string;
  payment_status: string;
  payment_id: string | null;
  custom_data: any;
  created_at: string;
}

interface Participant {
  email: string;
  nome: string;
  cognome: string;
  telefono: string;
  codice_fiscale: string | null;
  participant_id: string | null;
  registrations: EventRegistration[];
}

interface FlatRegistration {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  event_nome?: string;
  event_slug?: string;
}

const Admin = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: event } = useEvent(slug);
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [flatRegistrations, setFlatRegistrations] = useState<FlatRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const { toast } = useToast();

  const isGlobal = !slug;

  const authenticate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-registrations", {
        body: { password, format: "json", event_id: event?.id || null },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Errore", description: data.error, variant: "destructive" });
        return;
      }
      setParticipants(data.participants || []);
      setFlatRegistrations(data.registrations || []);
      setAuthenticated(true);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Password non valida", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-registrations", {
        body: { password, format: "csv", event_id: event?.id || null },
      });
      if (error) throw error;
      const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iscrizioni_${slug || "tutti"}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download avviato", description: "Il file CSV è stato scaricato." });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Errore durante il download.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === "paid" || status === "completed") return "default";
    if (status === "pending") return "secondary";
    return "destructive";
  };

  const homePath = slug ? `/${slug}` : "/";
  const title = isGlobal
    ? "Tutte le iscrizioni"
    : event?.nome
      ? `Iscrizioni — ${event.nome}`
      : "Iscrizioni";

  const totalRegistrations = participants.reduce((sum, p) => sum + p.registrations.length, 0);

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
            {isGlobal && (
              <p className="text-sm text-muted-foreground mt-1">Vista globale — tutti gli eventi</p>
            )}
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
              <Link to={homePath}>← Torna alla home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Event summary cards for global view
  const eventCounts = isGlobal
    ? flatRegistrations.reduce<Record<string, number>>((acc, r) => {
        const name = r.event_nome || "Sconosciuto";
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {})
    : null;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src={logoDark} alt="GINEPRO" className="h-8 object-contain" />
            <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
            <Badge variant="outline">{participants.length} partecipanti</Badge>
            {isGlobal && <Badge variant="outline">{totalRegistrations} iscrizioni</Badge>}
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadCSV} disabled={loading} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Scarica CSV
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={homePath}>Home</Link>
            </Button>
          </div>
        </div>

        {/* Event summary cards for global view */}
        {isGlobal && eventCounts && Object.keys(eventCounts).length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(eventCounts).map(([name, count]) => (
              <Card key={name} className="border-border/50 bg-card/80">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground truncate">{name}</p>
                  <p className="text-2xl font-bold text-foreground">{count}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Telefono</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nessuna iscrizione trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    participants.map((p) => {
                      const firstReg = p.registrations[0];
                      const multiEvent = p.registrations.length > 1;
                      return (
                        <TableRow key={p.email}>
                          <TableCell>
                            {multiEvent ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1.5"
                                onClick={() => setSelectedParticipant(p)}
                              >
                                <CalendarDays className="h-3.5 w-3.5" />
                                {p.registrations.length} eventi
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {firstReg?.event_nome || "—"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">{p.nome} {p.cognome}</TableCell>
                          <TableCell>{p.email}</TableCell>
                          <TableCell>{p.telefono}</TableCell>
                          <TableCell className="capitalize">{firstReg?.payment_method}</TableCell>
                          <TableCell>
                            <Badge variant={statusColor(firstReg?.payment_status)}>
                              {firstReg?.payment_status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {firstReg && new Date(firstReg.created_at).toLocaleDateString("it-IT", {
                              day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Multi-event participant detail dialog */}
        <Dialog open={!!selectedParticipant} onOpenChange={(open) => !open && setSelectedParticipant(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">
                {selectedParticipant?.nome} {selectedParticipant?.cognome}
              </DialogTitle>
              <DialogDescription>
                {selectedParticipant?.email} · {selectedParticipant?.registrations.length} eventi
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {selectedParticipant?.registrations.map((reg) => (
                <Card key={reg.id} className="border-border/50">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{reg.event_nome}</span>
                      <Badge variant={statusColor(reg.payment_status)}>{reg.payment_status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="capitalize">{reg.payment_method}</span>
                      <span>
                        {new Date(reg.created_at).toLocaleDateString("it-IT", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;
