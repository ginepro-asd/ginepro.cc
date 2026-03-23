import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, Check, AlertTriangle, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

const PARTICIPANT_FIELDS = [
  { key: "nome", label: "Nome", required: true },
  { key: "cognome", label: "Cognome", required: true },
  { key: "email", label: "Email", required: true },
  { key: "telefono", label: "Telefono", required: true },
  { key: "codice_fiscale", label: "Codice Fiscale" },
  { key: "birth_date", label: "Data di nascita" },
  { key: "birth_place", label: "Luogo di nascita" },
] as const;

interface AdminCsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  eventId?: string;
  eventName?: string;
  onSuccess: () => void;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === "," || ch === ";") { result.push(current.trim()); current = ""; }
        else current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine).filter((r) => r.some((c) => c));
  return { headers, rows };
}

function autoMapColumns(csvHeaders: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  const aliases: Record<string, string[]> = {
    nome: ["nome", "name", "first_name", "firstname", "first name"],
    cognome: ["cognome", "surname", "last_name", "lastname", "last name"],
    email: ["email", "e-mail", "mail"],
    telefono: ["telefono", "phone", "tel", "cellulare", "mobile"],
    codice_fiscale: ["codice_fiscale", "cf", "codice fiscale", "fiscal code", "tax code"],
    birth_date: ["birth_date", "data_nascita", "data di nascita", "birthdate", "date of birth", "dob"],
    birth_place: ["birth_place", "luogo_nascita", "luogo di nascita", "birthplace", "place of birth"],
  };

  csvHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase().trim();
    for (const [field, alts] of Object.entries(aliases)) {
      if (alts.includes(lower)) {
        mapping[idx] = field;
        break;
      }
    }
  });
  return mapping;
}

const AdminCsvImport = ({ open, onOpenChange, password, eventId, eventName, onSuccess }: AdminCsvImportProps) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "map" | "importing" | "done">("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [registerToEvent, setRegisterToEvent] = useState(!!eventId);
  const [paymentMethod, setPaymentMethod] = useState("contanti");

  // Import progress
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importResults, setImportResults] = useState<{ created: number; skipped: number; registered: number; errors: string[] }>({
    created: 0, skipped: 0, registered: 0, errors: [],
  });

  const reset = () => {
    setStep("upload");
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setRegisterToEvent(!!eventId);
    setPaymentMethod("contanti");
    setImportProgress(0);
    setImportTotal(0);
    setImportResults({ created: 0, skipped: 0, registered: 0, errors: [] });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (headers.length === 0) {
        toast({ title: "Errore", description: "Il file CSV è vuoto o non valido.", variant: "destructive" });
        return;
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setColumnMapping(autoMapColumns(headers));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const setMapping = (colIdx: number, field: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      // Remove any existing mapping to this field
      if (field !== "_skip") {
        for (const [k, v] of Object.entries(next)) {
          if (v === field) delete next[Number(k)];
        }
      }
      if (field === "_skip") delete next[colIdx];
      else next[colIdx] = field;
      return next;
    });
  };

  const mappedFields = new Set(Object.values(columnMapping));
  const requiredMissing = PARTICIPANT_FIELDS.filter((f) => f.required && !mappedFields.has(f.key));
  const canImport = requiredMissing.length === 0;

  const getRowValue = (row: string[], field: string): string => {
    for (const [colIdx, mappedField] of Object.entries(columnMapping)) {
      if (mappedField === field) return row[Number(colIdx)] || "";
    }
    return "";
  };

  const startImport = async () => {
    setStep("importing");
    setImportTotal(csvRows.length);
    const results = { created: 0, skipped: 0, registered: 0, errors: [] as string[] };

    for (let i = 0; i < csvRows.length; i++) {
      setImportProgress(i + 1);
      const row = csvRows[i];
      const nome = getRowValue(row, "nome").trim();
      const cognome = getRowValue(row, "cognome").trim();
      const email = getRowValue(row, "email").trim();
      const telefono = getRowValue(row, "telefono").trim();

      if (!nome || !cognome || !email || !telefono) {
        results.errors.push(`Riga ${i + 2}: dati obbligatori mancanti (${nome} ${cognome})`);
        results.skipped++;
        continue;
      }

      try {
        // Check if participant already exists
        const { data: existing } = await supabase
          .from("participants")
          .select("id")
          .ilike("nome", nome)
          .ilike("cognome", cognome)
          .limit(1);

        let participantId: string;

        if (existing && existing.length > 0) {
          participantId = existing[0].id;
          results.skipped++;
        } else {
          const participant: Record<string, any> = {
            nome, cognome, email, telefono,
            identification_type: "birth",
            newsletter: true,
          };
          const cf = getRowValue(row, "codice_fiscale");
          if (cf) participant.codice_fiscale = cf.toUpperCase();
          const bd = getRowValue(row, "birth_date");
          if (bd) participant.birth_date = bd;
          const bp = getRowValue(row, "birth_place");
          if (bp) participant.birth_place = bp;

          const { data, error } = await supabase.functions.invoke("manage-event", {
            body: { password, action: "create_participant", participant },
          });
          if (error) throw error;
          if (data.error) throw new Error(data.error);
          participantId = data.participant.id;
          results.created++;
        }

        // Register to event if requested
        if (registerToEvent && eventId) {
          const { data, error } = await supabase.functions.invoke("manage-event", {
            body: {
              password,
              action: "admin_register",
              participant_id: participantId,
              event_id: eventId,
              payment_method: paymentMethod,
              custom_data: {},
            },
          });
          if (error) throw error;
          if (data.error) {
            // Likely already registered
            results.errors.push(`${nome} ${cognome}: ${data.error}`);
          } else {
            results.registered++;
          }
        }
      } catch (err: any) {
        results.errors.push(`${nome} ${cognome}: ${err.message}`);
      }
    }

    setImportResults(results);
    setStep("done");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Importa da CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Seleziona un file CSV con i dati dei partecipanti."}
            {step === "map" && `${csvRows.length} righe trovate. Associa le colonne ai campi.`}
            {step === "importing" && `Importazione in corso... ${importProgress}/${importTotal}`}
            {step === "done" && "Importazione completata."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 mt-2">
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Clicca per selezionare un file CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Formati supportati: .csv (separatore virgola o punto e virgola)</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4 mt-2">
            {/* Column mapping */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Mappatura colonne</Label>
              <div className="border border-border rounded-lg divide-y divide-border">
                {csvHeaders.map((header, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-3 py-2">
                    <span className="text-sm font-mono text-muted-foreground min-w-[120px] truncate">{header}</span>
                    <span className="text-muted-foreground">→</span>
                    <Select value={columnMapping[idx] || "_skip"} onValueChange={(v) => setMapping(idx, v)}>
                      <SelectTrigger className="h-8 text-sm w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">
                          <span className="text-muted-foreground">— Ignora —</span>
                        </SelectItem>
                        {PARTICIPANT_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key} disabled={mappedFields.has(f.key) && columnMapping[idx] !== f.key}>
                            {f.label}{f.required ? " *" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {columnMapping[idx] && (
                      <Badge variant="secondary" className="text-xs">{PARTICIPANT_FIELDS.find(f => f.key === columnMapping[idx])?.label}</Badge>
                    )}
                  </div>
                ))}
              </div>
              {requiredMissing.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Campi obbligatori mancanti: {requiredMissing.map(f => f.label).join(", ")}
                </div>
              )}
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Anteprima (prime 5 righe)</Label>
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {PARTICIPANT_FIELDS.filter(f => mappedFields.has(f.key)).map(f => (
                        <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {PARTICIPANT_FIELDS.filter(f => mappedFields.has(f.key)).map(f => (
                          <TableCell key={f.key} className="text-xs">{getRowValue(row, f.key) || "—"}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Register to event option */}
            {eventId && (
              <div className="space-y-3 border-t border-border/50 pt-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="csv-register"
                    checked={registerToEvent}
                    onCheckedChange={(c) => setRegisterToEvent(!!c)}
                  />
                  <Label htmlFor="csv-register" className="text-sm">
                    Iscrivi anche all'evento{eventName ? ` "${eventName}"` : ""}
                  </Label>
                </div>
                {registerToEvent && (
                  <div className="space-y-1 ml-6">
                    <Label className="text-xs">Metodo di pagamento</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger className="h-8 text-sm w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contanti">Contanti</SelectItem>
                        <SelectItem value="admin">Admin (gratuito)</SelectItem>
                        <SelectItem value="imported">Importato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => { reset(); }}>Annulla</Button>
              <Button onClick={startImport} disabled={!canImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importa {csvRows.length} righe
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 mt-4 py-4">
            <Progress value={(importProgress / importTotal) * 100} className="h-2" />
            <p className="text-sm text-center text-muted-foreground">
              {importProgress} / {importTotal} righe elaborate...
            </p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{importResults.created}</p>
                <p className="text-xs text-muted-foreground">Creati</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-foreground">{importResults.skipped}</p>
                <p className="text-xs text-muted-foreground">Già esistenti</p>
              </div>
              {eventId && (
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{importResults.registered}</p>
                  <p className="text-xs text-muted-foreground">Iscritti</p>
                </div>
              )}
            </div>
            {importResults.errors.length > 0 && (
              <div className="space-y-1">
                <Label className="text-sm font-medium text-destructive">
                  {importResults.errors.length} errori
                </Label>
                <div className="max-h-[150px] overflow-y-auto bg-muted/30 rounded-lg p-3 space-y-1">
                  {importResults.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{err}</p>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => { reset(); onOpenChange(false); onSuccess(); }}>
                <Check className="h-4 w-4 mr-2" />
                Chiudi
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminCsvImport;
