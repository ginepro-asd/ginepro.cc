import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Check, AlertTriangle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  email: string;
  nome: string;
  cognome: string;
  telefono: string;
  codice_fiscale: string | null;
  birth_date: string | null;
  birth_place: string | null;
  participant_id: string | null;
  fidal_data: Record<string, any> | null;
  registrations: Array<{
    custom_data: Record<string, any> | null;
  }>;
}

interface FidalDialogProps {
  participant: Participant | null;
  password: string;
  onClose: () => void;
}

const PROVINCE = [
  "AG","AL","AN","AO","AR","AP","AT","AV","BA","BT","BL","BN","BG","BI","BO","BZ",
  "BS","BR","CA","CL","CB","CE","CT","CZ","CH","CO","CS","CR","KR","CN","EN","EE",
  "FM","FE","FI","FG","FC","FR","GE","GO","GR","IM","IS","AQ","SP","LT","LE","LC",
  "LI","LO","LU","MC","MN","MS","MT","ME","MI","MO","MB","NA","NO","NU","OR","PD",
  "PA","PR","PV","PG","PU","PE","PC","PI","PT","PN","PZ","PO","RG","RA","RC","RE",
  "RI","RN","RM","RO","SA","SS","SV","SI","SR","SO","SU","TA","TE","TR","TO","TP",
  "TN","TV","TS","UD","VA","VE","VB","VC","VR","VV","VI","VT",
];

const CATEGORIE = [
  { value: "", label: "Seleziona" },
  { value: "EF4", label: "ESORDIENTI F 4" }, { value: "EM4", label: "ESORDIENTI M 4" },
  { value: "EF6", label: "ESORDIENTI F 6" }, { value: "EM6", label: "ESORDIENTI M 6" },
  { value: "EF8", label: "ESORDIENTI F 8" }, { value: "EM8", label: "ESORDIENTI M 8" },
  { value: "EF10", label: "ESORDIENTI F 10" }, { value: "EM10", label: "ESORDIENTI M 10" },
  { value: "RF", label: "RAGAZZE" }, { value: "RM", label: "RAGAZZI" },
  { value: "CF", label: "CADETTE" }, { value: "CM", label: "CADETTI" },
  { value: "AF", label: "ALLIEVE" }, { value: "AM", label: "ALLIEVI" },
  { value: "JF", label: "JUNIORES DONNE" }, { value: "JM", label: "JUNIORES UOMINI" },
  { value: "PF", label: "PROMESSE DONNE" }, { value: "PM", label: "PROMESSE UOMINI" },
  { value: "SF", label: "SENIORES DONNE" }, { value: "SM", label: "SENIORES UOMINI" },
  { value: "SF35", label: "SENIORES/SF35" }, { value: "SM35", label: "SENIORES/SM35" },
  { value: "SF40", label: "SENIORES/SF40" }, { value: "SM40", label: "SENIORES/SM40" },
  { value: "SF45", label: "SENIORES/SF45" }, { value: "SM45", label: "SENIORES/SM45" },
  { value: "SF50", label: "SENIORES/SF50" }, { value: "SM50", label: "SENIORES/SM50" },
  { value: "SF55", label: "SENIORES/SF55" }, { value: "SM55", label: "SENIORES/SM55" },
  { value: "SF60", label: "SENIORES/SF60" }, { value: "SM60", label: "SENIORES/SM60" },
  { value: "SF65", label: "SENIORES/SF65" }, { value: "SM65", label: "SENIORES/SM65" },
  { value: "SF70", label: "SENIORES/SF70" }, { value: "SM70", label: "SENIORES/SM70" },
  { value: "SF75", label: "SENIORES/SF75" }, { value: "SM75", label: "SENIORES/SM75" },
  { value: "SF80", label: "SENIORES/SF80" }, { value: "SM80", label: "SENIORES/SM80" },
  { value: "SF85", label: "SENIORES/SF85" }, { value: "SM85", label: "SENIORES/SM85" },
  { value: "SF90", label: "SENIORES/SF90" }, { value: "SM90", label: "SENIORES/SM90" },
  { value: "SF95", label: "SENIORES/SF95" }, { value: "SM95", label: "SENIORES/SM95" },
];

/** Suggest FIDAL category from birth year and gender */
function suggestCategory(birthDate: string | null, gender: string): string {
  if (!birthDate) return "";
  const year = parseInt(birthDate.split("-")[0]);
  if (isNaN(year)) return "";
  const currentYear = 2026;
  const age = currentYear - year;
  const g = gender === "F" ? "F" : "M";

  if (age <= 5) return `E${g}4`;
  if (age <= 7) return `E${g}6`;
  if (age <= 9) return `E${g}8`;
  if (age <= 11) return `E${g}10`;
  if (age <= 13) return g === "F" ? "RF" : "RM";
  if (age <= 15) return g === "F" ? "CF" : "CM";
  if (age <= 17) return g === "F" ? "AF" : "AM";
  if (age <= 19) return g === "F" ? "JF" : "JM";
  if (age <= 22) return g === "F" ? "PF" : "PM";
  if (age < 35) return g === "F" ? "SF" : "SM";
  if (age < 40) return `S${g}35`;
  if (age < 45) return `S${g}40`;
  if (age < 50) return `S${g}45`;
  if (age < 55) return `S${g}50`;
  if (age < 60) return `S${g}55`;
  if (age < 65) return `S${g}60`;
  if (age < 70) return `S${g}65`;
  if (age < 75) return `S${g}70`;
  if (age < 80) return `S${g}75`;
  if (age < 85) return `S${g}80`;
  if (age < 90) return `S${g}85`;
  if (age < 95) return `S${g}90`;
  return `S${g}95`;
}

function deriveGender(cf: string | null, customData: Record<string, any>[]): string {
  // Check custom_data gender first
  for (const cd of customData) {
    if (cd?.gender) {
      const g = String(cd.gender).toLowerCase();
      if (g === "m" || g === "maschio" || g === "male") return "M";
      if (g === "f" || g === "femmina" || g === "female") return "F";
    }
  }
  // Derive from CF
  if (cf && cf.length >= 11) {
    const day = parseInt(cf.substring(9, 11));
    return day > 40 ? "F" : "M";
  }
  return "";
}

export default function FidalDialog({ participant, password, onClose }: FidalDialogProps) {
  const { toast } = useToast();

  const customDatas = useMemo(() => {
    if (!participant) return [];
    return participant.registrations
      .map((r) => r.custom_data)
      .filter(Boolean) as Record<string, any>[];
  }, [participant]);

  const gender = useMemo(
    () => (participant ? deriveGender(participant.codice_fiscale, customDatas) : ""),
    [participant, customDatas],
  );

  const suggestedCat = useMemo(
    () => suggestCategory(participant?.birth_date || null, gender),
    [participant, gender],
  );

  const fd = participant?.fidal_data || {};

  const [fields, setFields] = useState<Record<string, string>>({});

  // Re-initialize fields when participant changes
  useMemo(() => {
    const newFd = participant?.fidal_data || {};
    setFields({
      nonagonista: newFd.nonagonista || "S",
      categoria: newFd.categoria || suggestedCat,
      sesso: newFd.sesso || gender,
      indirizzo: newFd.indirizzo || "",
      cap: newFd.cap || "",
      provincia: newFd.provincia || "",
      citta: newFd.citta || "",
      straniero: newFd.straniero || "N",
      cittadinanza: newFd.cittadinanza || "ITA",
      doppia_cittadinanza: newFd.doppia_cittadinanza || "N",
      scad_cert: newFd.scad_cert || "",
    });
  }, [participant, suggestedCat, gender]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!participant) return null;

  const update = (key: string, val: string) => setFields((p) => ({ ...p, [key]: val }));

  // Format scad_cert from date input (YYYY-MM-DD) to dd/mm/yyyy for FIDAL
  const formatDate = (isoDate: string): string => {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const handleSubmit = async () => {
    // Validation
    const required = ["categoria", "sesso", "indirizzo", "cap", "provincia", "citta", "scad_cert"];
    const missing = required.filter((k) => !fields[k]);
    if (missing.length > 0) {
      toast({
        title: "Campi mancanti",
        description: `Compila: ${missing.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    setResult(null);
    try {
      const fidalData = {
        ...fields,
        scad_cert: formatDate(fields.scad_cert),
      };

      const { data, error } = await supabase.functions.invoke("submit-to-fidal", {
        body: {
          password,
          participant_id: participant.participant_id,
          fidal_data: fidalData,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setResult({
        success: data.success,
        message: `${data.submit?.message || "Completato"}. Foto: ${data.photo?.message || "N/A"}`,
      });

      if (data.success) {
        toast({ title: "Invio FIDAL completato", description: data.submit?.message });
      } else {
        toast({
          title: "Attenzione",
          description: data.submit?.message || "Verifica il risultato manualmente",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setResult({ success: false, message: err.message });
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const openFormProxy = () => {
    const fidalData = {
      ...fields,
      scad_cert: formatDate(fields.scad_cert),
    };
    const params = new URLSearchParams({
      password,
      participant_id: participant.participant_id || "",
      fidal_data: JSON.stringify(fidalData),
    });
    const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/fidal-form-proxy?${params.toString()}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={!!participant} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Inserimento FIDAL — {participant.nome} {participant.cognome}
          </DialogTitle>
          <DialogDescription>
            Completa i campi mancanti per l'inserimento su FIDAL.
            {participant.birth_date && ` Nato/a il ${participant.birth_date}.`}
            {participant.codice_fiscale && ` CF: ${participant.codice_fiscale}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Agonista */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Tipo *</Label>
              <select
                value={fields.nonagonista}
                onChange={(e) => update("nonagonista", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="N">AGONISTA</option>
                <option value="S">NON AGONISTA</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Sesso *</Label>
              <select
                value={fields.sesso}
                onChange={(e) => update("sesso", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Seleziona</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
              </select>
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1">
            <Label className="text-sm">
              Categoria * {suggestedCat && <span className="text-muted-foreground">(suggerita: {suggestedCat})</span>}
            </Label>
            <select
              value={fields.categoria}
              onChange={(e) => update("categoria", e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CATEGORIE.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Indirizzo */}
          <div className="space-y-1">
            <Label className="text-sm">Indirizzo *</Label>
            <Input value={fields.indirizzo} onChange={(e) => update("indirizzo", e.target.value)} />
          </div>

          {/* CAP + Provincia */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">CAP *</Label>
              <Input value={fields.cap} onChange={(e) => update("cap", e.target.value)} maxLength={5} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Provincia *</Label>
              <select
                value={fields.provincia}
                onChange={(e) => update("provincia", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">--</option>
                {PROVINCE.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Città *</Label>
              <Input value={fields.citta} onChange={(e) => update("citta", e.target.value)} />
            </div>
          </div>

          {/* Straniero / Cittadinanza */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Straniero</Label>
              <select
                value={fields.straniero}
                onChange={(e) => update("straniero", e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="N">No</option>
                <option value="S">Sì</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Cittadinanza</Label>
              <Input value={fields.cittadinanza} onChange={(e) => update("cittadinanza", e.target.value)} placeholder="ITA" />
            </div>
          </div>

          {/* Scadenza certificato medico */}
          <div className="space-y-1">
            <Label className="text-sm">Scadenza certificato medico *</Label>
            <Input type="date" value={fields.scad_cert} onChange={(e) => update("scad_cert", e.target.value)} />
          </div>

          {/* Result */}
          {result && (
            <div className={`p-3 rounded-lg border ${result.success ? "border-green-500/50 bg-green-500/10" : "border-destructive/50 bg-destructive/10"}`}>
              <div className="flex items-center gap-2 text-sm">
                {result.success ? <Check className="h-4 w-4 text-green-500" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span>{result.message}</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Invia a FIDAL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
