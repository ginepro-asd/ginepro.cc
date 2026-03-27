import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Check, AlertTriangle, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CustomField {
  key: string;
  label: string;
  type: "text" | "select" | "file" | "checkbox" | "number";
  required?: boolean;
  options?: string[];
}

const PARTICIPANT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "nome", label: "Nome", required: true },
  { key: "cognome", label: "Cognome", required: true },
  { key: "email", label: "Email", required: true },
  { key: "telefono", label: "Telefono", required: true },
  { key: "codice_fiscale", label: "Codice Fiscale" },
  { key: "birth_date", label: "Data di nascita" },
  { key: "birth_place", label: "Luogo di nascita" },
];

const CF_PREFIX = "cf:";

interface AdminCsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  password: string;
  eventId?: string;
  eventName?: string;
  eventCustomFields?: CustomField[];
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

function autoMapColumns(csvHeaders: string[], customFields: CustomField[]): Record<number, string> {
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

  // Add custom field aliases
  for (const cf of customFields) {
    aliases[CF_PREFIX + cf.key] = [cf.key.toLowerCase(), cf.label.toLowerCase()];
  }

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

const AdminCsvImport = ({ open, onOpenChange, password, eventId, eventName, eventCustomFields, onSuccess }: AdminCsvImportProps) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  // Filter custom fields to mappable types (exclude file)
  const mappableCustomFields = useMemo(() =>
    (eventCustomFields || []).filter(f => f.type !== "file"),
    [eventCustomFields]
  );

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

  // All mappable fields: participant + custom
  const allFields = useMemo(() => {
    const fields: { key: string; label: string; required?: boolean; isCustom?: boolean; options?: string[] }[] = [
      ...PARTICIPANT_FIELDS,
    ];
    for (const cf of mappableCustomFields) {
      fields.push({
        key: CF_PREFIX + cf.key,
        label: cf.label + " ⚙",
        required: cf.required,
        isCustom: true,
        options: cf.type === "select" ? cf.options : undefined,
      });
    }
    return fields;
  }, [mappableCustomFields]);

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
      setColumnMapping(autoMapColumns(headers, mappableCustomFields));
      setStep("map");
    };
    reader.readAsText(file);
  };

  const setMapping = (colIdx: number, field: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
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
  const requiredMissing = allFields.filter((f) => f.required && !mappedFields.has(f.key));
  
  // Validation: check select custom fields have valid values
  const validationErrors = useMemo(() => {
    if (!registerToEvent) return [];
    const errors: string[] = [];
    
    for (const field of allFields) {
      if (!field.isCustom || !field.options || !mappedFields.has(field.key)) continue;
      
      // Check all rows for invalid values
      const invalidRows: { row: number; value: string }[] = [];
      for (let i = 0; i < csvRows.length; i++) {
        const val = getRowValueFromMapping(csvRows[i], field.key);
        if (!val) continue; // empty is ok (will be caught by required check later)
        if (!field.options.some(opt => opt.toLowerCase() === val.toLowerCase())) {
          invalidRows.push({ row: i + 2, value: val });
        }
      }
      
      if (invalidRows.length > 0) {
        const sample = invalidRows.slice(0, 3).map(r => `riga ${r.row}: "${r.value}"`).join(", ");
        const more = invalidRows.length > 3 ? ` e altri ${invalidRows.length - 3}` : "";
        errors.push(
          `${field.label.replace(" ⚙", "")}: valori non validi (${sample}${more}). Valori ammessi: ${field.options.join(", ")}`
        );
      }
    }
    return errors;
  }, [allFields, mappedFields, csvRows, registerToEvent]);

  const canImport = requiredMissing.length === 0 && validationErrors.length === 0;

  function getRowValueFromMapping(row: string[], field: string): string {
    for (const [colIdx, mappedField] of Object.entries(columnMapping)) {
      if (mappedField === field) return row[Number(colIdx)] || "";
    }
    return "";
  }

  const getRowValue = (row: string[], field: string): string => getRowValueFromMapping(row, field);

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
        // Check if participant already exists (by name or email)
        const { data: byName } = await supabase
          .from("participants")
          .select("id")
          .ilike("nome", nome)
          .ilike("cognome", cognome)
          .limit(1);

        let existing = byName && byName.length > 0 ? byName : null;

        // Fallback: check by email if name didn't match
        if (!existing) {
          const { data: byEmail } = await supabase
            .from("participants")
            .select("id")
            .ilike("email", email)
            .limit(1);
          if (byEmail && byEmail.length > 0) existing = byEmail;
        }

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

          const res = await supabase.functions.invoke("manage-event", {
            body: { password, action: "create_participant", participant },
          });
          if (res.error) {
            // Extract actual error message from response
            const msg = typeof res.error === "object" && "context" in res.error
              ? await (res.error as any).context?.json?.().then((b: any) => b?.error).catch(() => null)
              : null;
            throw new Error(msg || res.error.message || "Errore creazione partecipante");
          }
          if (res.data.error) throw new Error(res.data.error);
          participantId = res.data.participant.id;
          results.created++;
        }

        // Register to event if requested
        if (registerToEvent && eventId) {
          // Build custom_data from mapped custom fields
          const customData: Record<string, any> = {};
          for (const cf of mappableCustomFields) {
            const val = getRowValue(row, CF_PREFIX + cf.key).trim();
            if (val) {
              // Normalize select values to match exact option casing
              if (cf.type === "select" && cf.options) {
                const match = cf.options.find(opt => opt.toLowerCase() === val.toLowerCase());
                customData[cf.key] = match || val;
              } else if (cf.type === "checkbox") {
                customData[cf.key] = ["true", "1", "sì", "si", "yes", "x"].includes(val.toLowerCase());
              } else if (cf.type === "number") {
                customData[cf.key] = Number(val) || 0;
              } else {
                customData[cf.key] = val;
              }
            }
          }

          const regRes = await supabase.functions.invoke("manage-event", {
            body: {
              password,
              action: "admin_register",
              participant_id: participantId,
              event_id: eventId,
              payment_method: paymentMethod,
              custom_data: customData,
            },
          });
          if (regRes.error) {
            const msg = typeof regRes.error === "object" && "context" in regRes.error
              ? await (regRes.error as any).context?.json?.().then((b: any) => b?.error).catch(() => null)
              : null;
            throw new Error(msg || regRes.error.message || "Errore registrazione");
          }
          if (regRes.data.error) {
            results.errors.push(`${nome} ${cognome}: ${regRes.data.error}`);
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
                        {mappableCustomFields.length > 0 && (
                          <>
                            <SelectItem value="_separator_cf" disabled>
                              <span className="text-xs text-muted-foreground font-medium">— Campi evento —</span>
                            </SelectItem>
                            {mappableCustomFields.map((cf) => (
                              <SelectItem
                                key={CF_PREFIX + cf.key}
                                value={CF_PREFIX + cf.key}
                                disabled={mappedFields.has(CF_PREFIX + cf.key) && columnMapping[idx] !== CF_PREFIX + cf.key}
                              >
                                {cf.label}{cf.required ? " *" : ""} {cf.type === "select" ? "📋" : ""}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {columnMapping[idx] && (
                      <Badge
                        variant={columnMapping[idx].startsWith(CF_PREFIX) ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {allFields.find(f => f.key === columnMapping[idx])?.label?.replace(" ⚙", "") || columnMapping[idx]}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
              {requiredMissing.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Campi obbligatori mancanti: {requiredMissing.map(f => f.label.replace(" ⚙", "")).join(", ")}
                </div>
              )}
            </div>

            {/* Validation errors for select fields */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-1">
                  <p className="font-medium">Validazione fallita — correggi il CSV prima di importare:</p>
                  {validationErrors.map((err, i) => (
                    <p key={i} className="text-xs">{err}</p>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Anteprima (prime 5 righe)</Label>
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {allFields.filter(f => mappedFields.has(f.key)).map(f => (
                        <TableHead key={f.key} className="text-xs whitespace-nowrap">{f.label.replace(" ⚙", "")}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {allFields.filter(f => mappedFields.has(f.key)).map(f => (
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
