import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Download, FileSpreadsheet, Loader2, Eye, EyeOff, Upload, Info, Check, Search, Filter, Merge, X } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  custom_data: Record<string, any> | null;
  created_at: string;
}

interface Participant {
  email: string;
  nome: string;
  cognome: string;
  telefono: string;
  codice_fiscale: string | null;
  birth_date: string | null;
  birth_place: string | null;
  participant_id: string | null;
  registrations: EventRegistration[];
}

interface FlatRegistration {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  codice_fiscale: string | null;
  birth_date: string | null;
  birth_place: string | null;
  payment_method: string;
  payment_status: string;
  custom_data: Record<string, any> | null;
  created_at: string;
  event_nome?: string;
  event_slug?: string;
}

interface FirestoreEvent {
  firestore_id: string;
  name: string;
  is_tesseramento: boolean;
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
  const [detailRegistration, setDetailRegistration] = useState<FlatRegistration | null>(null);
  // Firestore import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [firestoreEvents, setFirestoreEvents] = useState<FirestoreEvent[]>([]);
  const [loadingFirestore, setLoadingFirestore] = useState(false);
  const [importingEventId, setImportingEventId] = useState<string | null>(null);
  const [importedEvents, setImportedEvents] = useState<Set<string>>(new Set());
  // Filter & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEvent, setFilterEvent] = useState<string>("all");
  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Participant[]>([]);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeKeepId, setMergeKeepId] = useState<string | null>(null);
  const [mergeConflicts, setMergeConflicts] = useState<Record<string, { keep: any; merge: any }>>({});
  const [resolvedFields, setResolvedFields] = useState<Record<string, any>>({});
  const [merging, setMerging] = useState(false);
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

  const openImportDialog = async () => {
    setShowImportDialog(true);
    setLoadingFirestore(true);
    try {
      const { data, error } = await supabase.functions.invoke("import-firestore", {
        body: { password, action: "list" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setFirestoreEvents(data.events || []);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setShowImportDialog(false);
    } finally {
      setLoadingFirestore(false);
    }
  };

  const importSingleEvent = async (firestoreId: string) => {
    setImportingEventId(firestoreId);
    try {
      const { data, error } = await supabase.functions.invoke("import-firestore", {
        body: { password, firestore_event_id: firestoreId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setImportedEvents((prev) => new Set(prev).add(firestoreId));
      toast({
        title: `Importato: ${data.event_name}`,
        description: `${data.participantsCreated} nuovi partecipanti, ${data.registrationsCreated} iscrizioni. ${data.errors?.length || 0} errori.`,
      });
    } catch (err: any) {
      toast({ title: "Errore importazione", description: err.message, variant: "destructive" });
    } finally {
      setImportingEventId(null);
    }
  };

  const statusColor = (status: string) => {
    if (status === "paid" || status === "completed") return "default" as const;
    if (status === "pending") return "secondary" as const;
    return "destructive" as const;
  };

  const homePath = slug ? `/${slug}` : "/";
  const title = isGlobal
    ? "Tutte le iscrizioni"
    : event?.nome
      ? `Iscrizioni — ${event.nome}`
      : "Iscrizioni";

  const totalRegistrations = participants.reduce((sum, p) => sum + p.registrations.length, 0);

  const prettyLabel = (key: string) => {
    const map: Record<string, string> = {
      team: "Squadra", photo: "Foto", signature: "Firma", type: "Tipo",
      gender: "Sesso", distance: "Distanza", food: "Pasto", bib: "Pettorale",
      address: "Indirizzo", city: "Città", cap: "CAP", province: "Provincia",
      nation: "Nazione", emergencyContact: "Contatto emergenza",
      emergencyPhone: "Telefono emergenza", medicalCertificate: "Certificato medico",
      tShirtSize: "Taglia maglietta", notes: "Note",
    };
    return map[key] || key;
  };

  const toggleMergeSelect = (p: Participant) => {
    setMergeSelection((prev) => {
      const exists = prev.find((x) => (x.participant_id || x.email) === (p.participant_id || p.email));
      if (exists) return prev.filter((x) => (x.participant_id || x.email) !== (p.participant_id || p.email));
      if (prev.length >= 2) return prev; // max 2
      return [...prev, p];
    });
  };

  const isMergeSelected = (p: Participant) =>
    mergeSelection.some((x) => (x.participant_id || x.email) === (p.participant_id || p.email));

  const startMergeReview = () => {
    if (mergeSelection.length !== 2) return;
    const [a, b] = mergeSelection;
    // Default keep: first selected
    setMergeKeepId(a.participant_id || a.email);

    // Find conflicts: fields where both are non-null and different
    const fields = ["nome", "cognome", "email", "telefono", "codice_fiscale", "birth_date", "birth_place"];
    const conflicts: Record<string, { keep: any; merge: any }> = {};
    for (const f of fields) {
      const va = (a as any)[f];
      const vb = (b as any)[f];
      if (va != null && vb != null && va !== vb) {
        conflicts[f] = { keep: va, merge: vb };
      }
    }
    setMergeConflicts(conflicts);
    // Pre-resolve: default to keep's values
    const resolved: Record<string, any> = {};
    for (const f of Object.keys(conflicts)) {
      resolved[f] = conflicts[f].keep;
    }
    setResolvedFields(resolved);
    setShowMergeDialog(true);
  };

  const executeMerge = async () => {
    if (mergeSelection.length !== 2) return;
    const keepPart = mergeSelection.find(p => (p.participant_id || p.email) === mergeKeepId) || mergeSelection[0];
    const mergePart = mergeSelection.find(p => p !== keepPart) || mergeSelection[1];

    if (!keepPart.participant_id || !mergePart.participant_id) {
      toast({ title: "Errore", description: "Entrambi devono avere un ID partecipante", variant: "destructive" });
      return;
    }

    setMerging(true);
    try {
      const { data, error } = await supabase.functions.invoke("merge-participants", {
        body: {
          password,
          keep_id: keepPart.participant_id,
          merge_id: mergePart.participant_id,
          resolved_fields: resolvedFields,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast({
        title: "Unione completata",
        description: `${data.moved_registrations} iscrizioni spostate, ${data.merged_fields.length} campi aggiornati.`,
      });
      setShowMergeDialog(false);
      setMergeMode(false);
      setMergeSelection([]);
      // Refresh data
      authenticate();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
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

  const eventCounts = isGlobal
    ? flatRegistrations.reduce<Record<string, number>>((acc, r) => {
        const name = r.event_nome || "Sconosciuto";
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {})
    : null;

  // Unique event names for filter
  const eventNames = [...new Set(flatRegistrations.map(r => r.event_nome).filter(Boolean))] as string[];

  // Apply filters
  const filteredRegistrations = flatRegistrations.filter((r) => {
    if (filterEvent !== "all" && r.event_nome !== filterEvent) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName = `${r.nome} ${r.cognome}`.toLowerCase();
      if (!fullName.includes(q) && !r.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Always use grouped view in global mode
  const isGroupedView = isGlobal;

  // Filter participants by search query and event filter
  const filteredParticipants = participants.filter((p) => {
    // Event filter first
    if (filterEvent !== "all") {
      const hasEvent = p.registrations.some(r => r.event_nome === filterEvent);
      if (!hasEvent) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      const fullName = `${p.nome} ${p.cognome}`.toLowerCase();
      const emailMatch = p.email.toLowerCase().includes(q);
      const nameMatch = fullName.includes(q);
      const cfMatch = p.codice_fiscale?.toLowerCase().includes(q) || false;
      const eventMatch = p.registrations.some(r => r.event_nome?.toLowerCase().includes(q));
      if (!nameMatch && !emailMatch && !cfMatch && !eventMatch) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <img src={logoDark} alt="GINEPRO" className="h-8 object-contain" />
            <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
            <Badge variant="outline">{participants.length} partecipanti</Badge>
            {isGlobal && <Badge variant="outline">{totalRegistrations} iscrizioni</Badge>}
          </div>
          <div className="flex gap-2">
            {isGlobal && (
              <>
                <Button
                  onClick={() => {
                    setMergeMode(!mergeMode);
                    setMergeSelection([]);
                  }}
                  variant={mergeMode ? "default" : "outline"}
                >
                  {mergeMode ? <X className="h-4 w-4 mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
                  {mergeMode ? "Annulla unione" : "Unisci account"}
                </Button>
                <Button onClick={openImportDialog} variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Importa da Firestore
                </Button>
              </>
            )}
            <Button onClick={downloadCSV} disabled={loading} variant="outline">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Scarica CSV
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={homePath}>Home</Link>
            </Button>
          </div>
        </div>

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

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per nome o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {eventNames.length > 1 && (
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Tutti gli eventi</option>
              {eventNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          <Badge variant="outline">
            {isGroupedView ? `${filteredParticipants.length} partecipanti` : `${filteredRegistrations.length} risultati`}
          </Badge>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {isGroupedView ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>C.F.</TableHead>
                      <TableHead>Data nascita</TableHead>
                      <TableHead>Luogo nascita</TableHead>
                      <TableHead>Eventi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Nessun partecipante trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredParticipants.map((p, idx) => (
                        <TableRow key={`${p.participant_id || p.email}-${idx}`}>
                          <TableCell className="font-medium whitespace-nowrap">{p.nome} {p.cognome}</TableCell>
                          <TableCell className="text-sm">{p.email}</TableCell>
                          <TableCell className="text-sm">{p.telefono}</TableCell>
                          <TableCell className="text-xs font-mono">{p.codice_fiscale || "—"}</TableCell>
                          <TableCell className="text-sm">{p.birth_date || "—"}</TableCell>
                          <TableCell className="text-sm">{p.birth_place || "—"}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => setSelectedParticipant(p)}
                            >
                              {p.registrations.length} {p.registrations.length === 1 ? "evento" : "eventi"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>C.F.</TableHead>
                      <TableHead>Data nascita</TableHead>
                      <TableHead>Luogo nascita</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistrations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Nessuna iscrizione trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRegistrations.map((r) => {
                        const hasCustom = r.custom_data && Object.keys(r.custom_data).length > 0;
                        return (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {r.event_nome || "—"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{r.nome} {r.cognome}</TableCell>
                            <TableCell className="text-sm">{r.email}</TableCell>
                            <TableCell className="text-sm">{r.telefono}</TableCell>
                            <TableCell className="text-xs font-mono">{r.codice_fiscale || "—"}</TableCell>
                            <TableCell className="text-sm">{r.birth_date || "—"}</TableCell>
                            <TableCell className="text-sm">{r.birth_place || "—"}</TableCell>
                            <TableCell className="capitalize text-sm">{r.payment_method}</TableCell>
                            <TableCell>
                              <Badge variant={statusColor(r.payment_status)}>
                                {r.payment_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {new Date(r.created_at).toLocaleDateString("it-IT", {
                                day: "2-digit", month: "short", year: "numeric",
                              })}
                            </TableCell>
                            <TableCell>
                              {hasCustom && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setDetailRegistration(r)}
                                >
                                  <Info className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Registration detail modal */}
        <Dialog open={!!detailRegistration} onOpenChange={(open) => !open && setDetailRegistration(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">
                Dettagli — {detailRegistration?.nome} {detailRegistration?.cognome}
              </DialogTitle>
              <DialogDescription>
                {detailRegistration?.event_nome} · {detailRegistration?.email}
              </DialogDescription>
            </DialogHeader>
            {detailRegistration?.custom_data && (
              <div className="space-y-3 mt-2">
                {Object.entries(detailRegistration.custom_data).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                    <span className="text-sm font-medium text-muted-foreground">{prettyLabel(key)}</span>
                    <span className="text-sm text-foreground text-right max-w-[60%] break-words">
                      {typeof value === "boolean" ? (value ? "Sì" : "No") : String(value || "—")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

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

        {/* Firestore import dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Importa da Firestore</DialogTitle>
              <DialogDescription>
                Seleziona un evento da importare. Gli eventi verranno creati come inattivi.
              </DialogDescription>
            </DialogHeader>
            {loadingFirestore ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {firestoreEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nessun evento trovato.</p>
                )}
                {firestoreEvents.map((fe) => {
                  const isImported = importedEvents.has(fe.firestore_id);
                  const isImporting = importingEventId === fe.firestore_id;
                  return (
                    <div
                      key={fe.firestore_id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50"
                    >
                      <div>
                        <p className="font-medium text-sm text-foreground">{fe.name}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{fe.firestore_id}</span>
                          {fe.is_tesseramento && (
                            <Badge variant="secondary" className="text-xs h-4">Tesseramento</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={isImported ? "ghost" : "default"}
                        disabled={isImporting || isImported}
                        onClick={() => importSingleEvent(fe.firestore_id)}
                      >
                        {isImporting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isImported ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          "Importa"
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Admin;
