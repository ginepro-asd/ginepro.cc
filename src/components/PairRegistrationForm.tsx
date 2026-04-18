import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsExpired } from "@/components/Countdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, Smartphone, CircleDollarSign, Lock, Loader2, Calculator, Users, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SatispayWaiting from "@/components/SatispayWaiting";
import DualSatispayWaiting from "@/components/DualSatispayWaiting";
import SearchableSelect from "@/components/SearchableSelect";
import { useItalianComuni } from "@/hooks/use-italian-comuni";
import { COUNTRIES } from "@/data/countries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventData, CustomField } from "@/hooks/use-event";
import { formatPrice } from "@/hooks/use-event";
import {
  getOptionPrice,
  getRouteSelectionField,
} from "@/lib/event-pricing";
import CodiceFiscale from "codice-fiscale-js";

function obfuscateEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***.***";
  const oLocal = local.length <= 2 ? local[0] + "***" : local[0] + local[1] + "***" + local.slice(-1);
  const parts = domain.split(".");
  const oDomain = parts[0].length <= 2 ? parts[0][0] + "***" : parts[0][0] + parts[0][1] + "***" + parts[0].slice(-1);
  return `${oLocal}@${oDomain}.${parts.slice(1).join(".")}`;
}

function obfuscatePhone(phone: string): string {
  if (phone.length <= 6) return "***";
  return phone.slice(0, phone.length > 10 ? 6 : 3) + "***" + phone.slice(-3);
}

function obfuscateCF(cf: string | null): string {
  if (!cf || cf.length < 10) return "***";
  return cf.slice(0, 3) + "***" + cf.slice(6, 9) + "***" + cf.slice(-2);
}

interface MatchedParticipant {
  id: string;
  email: string;
  telefono: string;
  codice_fiscale: string | null;
  birth_date: string | null;
  birth_place: string | null;
  identification_type: string;
}

const COUNTRY_CODES = [
  { code: "+39", country: "🇮🇹 IT", label: "Italia" },
  { code: "+41", country: "🇨🇭 CH", label: "Svizzera" },
  { code: "+43", country: "🇦🇹 AT", label: "Austria" },
  { code: "+33", country: "🇫🇷 FR", label: "Francia" },
  { code: "+49", country: "🇩🇪 DE", label: "Germania" },
  { code: "+44", country: "🇬🇧 GB", label: "Regno Unito" },
  { code: "+34", country: "🇪🇸 ES", label: "Spagna" },
  { code: "+1", country: "🇺🇸 US", label: "USA" },
];

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-4 w-4 text-muted-foreground" />,
  satispay: <Smartphone className="h-4 w-4 text-muted-foreground" />,
  paypal: <CircleDollarSign className="h-4 w-4 text-muted-foreground" />,
};

const PAYMENT_LABELS: Record<string, string> = {
  stripe: "Carta",
  satispay: "Satispay",
  paypal: "PayPal",
};

function stripProvincia(comune: string): string {
  return comune.replace(/\s*\([A-Z]{2}\)$/, "");
}

function extractProvincia(comune: string): string {
  const match = comune.match(/\(([A-Z]{2})\)$/);
  return match ? match[1] : "";
}

function tryComputeCF(
  nome: string, cognome: string, birthDate: string, birthPlace: string, gender: "M" | "F", bornAbroad: boolean
): string | null {
  if (!nome || !cognome || !birthDate || !birthPlace || !gender) return null;
  try {
    const date = new Date(birthDate);
    const placeName = bornAbroad ? birthPlace : stripProvincia(birthPlace);
    const cf = new CodiceFiscale({
      name: nome, surname: cognome, gender,
      day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear(),
      birthplace: placeName, birthplaceProvincia: bornAbroad ? "EE" : extractProvincia(birthPlace),
    });
    return cf.toString();
  } catch { return null; }
}

interface PersonState {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  countryCode: string;
  identificationType: "birth" | "fiscal";
  birthDate: string;
  birthPlace: string;
  gender: "M" | "F" | "";
  codiceFiscale: string;
  bornAbroad: boolean;
  computedCF: string | null;
  returningUserData: MatchedParticipant | null;
}

const emptyPerson = (): PersonState => ({
  nome: "", cognome: "", email: "", telefono: "",
  countryCode: "+39", identificationType: "birth",
  birthDate: "", birthPlace: "", gender: "", codiceFiscale: "",
  bornAbroad: false, computedCF: null, returningUserData: null,
});

interface PairRegistrationFormProps {
  event: EventData;
  preselectedDiscipline?: string;
}

function PersonFormFields({
  label, person, onChange, comuni, comuniLoading,
}: {
  label: string;
  person: PersonState;
  onChange: (p: PersonState) => void;
  comuni: string[];
  comuniLoading: boolean;
}) {
  const [matchedUsers, setMatchedUsers] = useState<MatchedParticipant[]>([]);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const lookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const isReturning = !!person.returningUserData;

  const update = (fields: Partial<PersonState>) => {
    const next = { ...person, ...fields };
    if (next.identificationType === "birth" && next.nome && next.cognome && next.birthDate && next.birthPlace && next.gender) {
      next.computedCF = tryComputeCF(next.nome, next.cognome, next.birthDate, next.birthPlace, next.gender as "M" | "F", next.bornAbroad);
      if (next.computedCF) next.codiceFiscale = next.computedCF;
    }
    onChange(next);
  };

  useEffect(() => {
    if (matchDismissed || isReturning) return;
    if (!person.nome?.trim() || !person.cognome?.trim()) { setMatchedUsers([]); return; }
    if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
    lookupTimeoutRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("participants")
          .select("id, email, telefono, codice_fiscale, birth_date, birth_place, identification_type")
          .ilike("nome", person.nome.trim())
          .ilike("cognome", person.cognome.trim())
          .limit(10);
        if (data && data.length > 0) { setMatchedUsers(data); setShowMatchDialog(true); }
        else { setMatchedUsers([]); }
      } catch {}
    }, 800);
    return () => { if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current); };
  }, [person.nome, person.cognome, matchDismissed, isReturning]);

  const handleSelectMatch = (match: MatchedParticipant) => {
    const phoneMatch = match.telefono.match(/^(\+\d{1,3})/);
    const cc = phoneMatch ? COUNTRY_CODES.find(c => c.code === phoneMatch[1])?.code || "+39" : "+39";
    onChange({
      ...person,
      email: obfuscateEmail(match.email),
      telefono: obfuscatePhone(match.telefono),
      countryCode: cc,
      codiceFiscale: match.codice_fiscale ? obfuscateCF(match.codice_fiscale) : person.codiceFiscale,
      identificationType: match.codice_fiscale ? "fiscal" : person.identificationType,
      birthDate: match.birth_date || person.birthDate,
      birthPlace: match.birth_place || person.birthPlace,
      returningUserData: match,
    });
    setShowMatchDialog(false);
    setMatchDismissed(true);
    toast({ title: "Dati recuperati!", description: "Abbiamo precompilato il form con i tuoi dati." });
  };

  return (
    <>
      <Dialog open={showMatchDialog} onOpenChange={(open) => { if (!open) { setShowMatchDialog(false); setMatchDismissed(true); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-5 w-5 text-primary" />
              <DialogTitle className="font-display">Ci conosciamo già?</DialogTitle>
            </div>
            <DialogDescription>
              Abbiamo trovato {matchedUsers.length > 1 ? "alcune iscrizioni" : "un'iscrizione"} con questo nome. Sei tu?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {matchedUsers.map((m) => (
              <button key={m.id} type="button" onClick={() => handleSelectMatch(m)}
                className="w-full text-left border border-border rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-all space-y-1">
                <div className="text-sm">
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium font-mono text-foreground">{obfuscateEmail(m.email)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Telefono: </span>
                  <span className="font-medium font-mono text-foreground">{obfuscatePhone(m.telefono)}</span>
                </div>
                {m.codice_fiscale && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">C.F.: </span>
                    <span className="font-medium font-mono text-foreground">{obfuscateCF(m.codice_fiscale)}</span>
                  </div>
                )}
              </button>
            ))}
            <Button variant="ghost" className="w-full text-muted-foreground"
              onClick={() => { setShowMatchDialog(false); setMatchDismissed(true); }}>
              No, sono un nuovo iscritto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {label}
            {isReturning && (
              <span className="text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-auto">
                <UserCheck className="h-3 w-3 inline mr-1" />Riconosciuto
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome *</Label>
              <Input placeholder="Mario" value={person.nome} onChange={(e) => update({ nome: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cognome *</Label>
              <Input placeholder="Rossi" value={person.cognome} onChange={(e) => update({ cognome: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Email *</Label>
            <Input type="email" placeholder="mario@email.com" value={person.email} readOnly={isReturning} onChange={(e) => update({ email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Telefono *</Label>
            <div className="flex gap-2">
              <select value={person.countryCode} onChange={(e) => update({ countryCode: e.target.value })} disabled={isReturning}
                className="flex h-10 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-[90px] shrink-0">
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.country} {c.code}</option>
                ))}
              </select>
              <Input type="tel" placeholder="333 1234567" value={person.telefono} readOnly={isReturning} onChange={(e) => update({ telefono: e.target.value })} />
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Identificazione *</Label>
            <RadioGroup value={person.identificationType}
              onValueChange={(v) => !isReturning && update({ identificationType: v as "birth" | "fiscal", computedCF: null })}
              className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="birth" id={`birth-${label}`} disabled={isReturning} />
                <Label htmlFor={`birth-${label}`} className="cursor-pointer">Data/Luogo di nascita</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="fiscal" id={`fiscal-${label}`} disabled={isReturning} />
                <Label htmlFor={`fiscal-${label}`} className="cursor-pointer">Codice Fiscale</Label>
              </div>
            </RadioGroup>
            {person.identificationType === "fiscal" ? (
              <div className="space-y-1.5">
                <Input placeholder="RSSMRA85M01H501Z" maxLength={16} className="uppercase"
                  value={person.codiceFiscale} readOnly={isReturning}
                  onChange={(e) => update({ codiceFiscale: e.target.value.toUpperCase() })} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id={`abroad-${label}`} checked={person.bornAbroad}
                    onCheckedChange={(checked) => update({ bornAbroad: !!checked, birthPlace: "" })} />
                  <Label htmlFor={`abroad-${label}`} className="cursor-pointer text-sm text-muted-foreground">Nato/a all'estero</Label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Sesso *</Label>
                  <RadioGroup value={person.gender} onValueChange={(v) => update({ gender: v as "M" | "F" })} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="M" id={`gender-m-${label}`} />
                      <Label htmlFor={`gender-m-${label}`} className="cursor-pointer">M</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="F" id={`gender-f-${label}`} />
                      <Label htmlFor={`gender-f-${label}`} className="cursor-pointer">F</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Data di nascita</Label>
                    <Input type="date" value={person.birthDate} onChange={(e) => update({ birthDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">{person.bornAbroad ? "Nazione di nascita" : "Comune di nascita"}</Label>
                    <SearchableSelect options={person.bornAbroad ? COUNTRIES : comuni} value={person.birthPlace}
                      onChange={(v) => update({ birthPlace: v })}
                      placeholder={person.bornAbroad ? "Seleziona nazione..." : "Seleziona comune..."}
                      searchPlaceholder={person.bornAbroad ? "Cerca nazione..." : "Cerca comune..."}
                      emptyMessage="Nessun risultato trovato." loading={!person.bornAbroad && comuniLoading} />
                  </div>
                </div>
                {person.computedCF && (
                  <div className="bg-muted/50 border border-border rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                      <Calculator className="h-3.5 w-3.5" />Codice Fiscale calcolato
                    </div>
                    <p className="font-mono text-sm font-semibold text-foreground tracking-wider">{person.computedCF}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

const PairRegistrationForm = ({ event, preselectedDiscipline }: PairRegistrationFormProps) => {
  const deadline = getEffectiveDeadline(event);
  const expired = useIsExpired(deadline);
  const { comuni, loading: comuniLoading } = useItalianComuni();
  const [personA, setPersonA] = useState<PersonState>(emptyPerson());
  const [personB, setPersonB] = useState<PersonState>(emptyPerson());
  const [paymentMethod, setPaymentMethod] = useState<string>(event.payment_methods[0] || "stripe");
  const [satispayPayer, setSatispayPayer] = useState<"each" | "a" | "b">("each");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [satispayState, setSatispayState] = useState<{ paymentId: string; registrationId: string; paymentIdB?: string; registrationIdB?: string } | null>(null);
  const { toast } = useToast();

  const routeField = getRouteSelectionField(event.custom_fields);
  const [routeSelection, setRouteSelection] = useState<string>(preselectedDiscipline || routeField?.options?.[0] || "");
  const unitPrice = getOptionPrice(routeField, preselectedDiscipline || routeSelection) ?? event.prezzo;
  const totalPrice = unitPrice * 2;

  useEffect(() => {
    if (preselectedDiscipline) {
      setRouteSelection(preselectedDiscipline);
    } else {
      setRouteSelection(routeField?.options?.[0] || "");
    }
  }, [preselectedDiscipline, routeField?.key, routeField?.options?.join("|")]);

  const validatePerson = (p: PersonState, label: string): string | null => {
    if (!p.nome.trim()) return `${label}: Nome è obbligatorio`;
    if (!p.cognome.trim()) return `${label}: Cognome è obbligatorio`;
    // Skip email/phone validation for returning users (obfuscated)
    if (!p.returningUserData) {
      if (!p.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return `${label}: Email non valida`;
      if (!p.telefono.trim() || p.telefono.length < 6) return `${label}: Telefono non valido`;
    }
    if (p.identificationType === "birth") {
      if (!p.returningUserData && (!p.birthDate || !p.birthPlace || !p.gender)) return `${label}: Compila data, luogo di nascita e sesso`;
    } else {
      if (!p.returningUserData && (!p.codiceFiscale || p.codiceFiscale.length < 11)) return `${label}: Codice Fiscale non valido`;
    }
    return null;
  };

  const buildPayload = (p: PersonState) => {
    const ret = p.returningUserData;
    return {
      nome: p.nome.trim(),
      cognome: p.cognome.trim(),
      email: ret ? ret.email : p.email.trim(),
      telefono: ret ? ret.telefono : `${p.countryCode}${p.telefono.replace(/[\s\-()]/g, "").replace(/^\+\d{1,3}/, "")}`,
      identificationType: ret ? ret.identification_type : p.identificationType,
      birthDate: ret ? ret.birth_date : (p.birthDate || null),
      birthPlace: ret ? ret.birth_place : (p.birthPlace || null),
      codiceFiscale: ret ? ret.codice_fiscale : (p.codiceFiscale || p.computedCF || null),
      participantId: ret ? ret.id : undefined,
    };
  };

  const onSubmit = async () => {
    const errA = validatePerson(personA, "Componente A");
    if (errA) { toast({ title: "Errore", description: errA, variant: "destructive" }); return; }
    const errB = validatePerson(personB, "Componente B");
    if (errB) { toast({ title: "Errore", description: errB, variant: "destructive" }); return; }

    setIsSubmitting(true);
    try {
      const body = {
        participantA: buildPayload(personA),
        participantB: buildPayload(personB),
        paymentMethod,
        eventId: event.id,
        customData: routeField && routeSelection ? { [routeField.key]: routeSelection } : {},
        disciplina: routeField?.key === "disciplina" ? routeSelection : undefined,
        ...(paymentMethod === "satispay" ? { satispayPayer } : {}),
      };

      const { data: result, error } = await supabase.functions.invoke("create-pair-checkout", { body });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);

      if (paymentMethod === "stripe" || paymentMethod === "paypal") {
        if (result?.url) {
          window.location.href = result.url;
        } else {
          throw new Error("Nessun URL di pagamento ricevuto");
        }
      } else if (paymentMethod === "satispay") {
        if (result?.payment_id && result?.registration_id) {
          setSatispayState({
            paymentId: result.payment_id,
            registrationId: result.registration_id,
            paymentIdB: result.payment_id_b,
            registrationIdB: result.registration_id_b,
          });
        } else {
          throw new Error("Errore Satispay");
        }
      }
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Errore durante la creazione del pagamento.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (expired) {
    return (
      <section id="iscrizione" className="py-16 sm:py-24 px-4">
        <div className="max-w-lg mx-auto">
          <Alert className="border-secondary bg-secondary/10">
            <Lock className="h-5 w-5 text-secondary" />
            <AlertTitle className="font-display text-lg">Iscrizioni online chiuse</AlertTitle>
            <AlertDescription>{CLOSED_REGISTRATION_MESSAGE}</AlertDescription>
          </Alert>
        </div>
      </section>
    );
  }

  if (satispayState) {
    // Dual payment flow: each pays their share
    if (satispayState.paymentIdB && satispayState.registrationIdB) {
      return (
        <section id="iscrizione" className="py-16 sm:py-24 px-4">
          <div className="max-w-xl mx-auto">
            <DualSatispayWaiting
              paymentIdA={satispayState.paymentId}
              registrationIdA={satispayState.registrationId}
              paymentIdB={satispayState.paymentIdB}
              registrationIdB={satispayState.registrationIdB}
              onCancel={() => setSatispayState(null)}
              eventSlug={event.slug}
              priceEach={unitPrice}
              nameA={`${personA.nome} ${personA.cognome}`}
              nameB={`${personB.nome} ${personB.cognome}`}
            />
          </div>
        </section>
      );
    }
    // Single payer flow
    return (
      <section id="iscrizione" className="py-16 sm:py-24 px-4">
        <div className="max-w-xl mx-auto">
          <SatispayWaiting
            paymentId={satispayState.paymentId}
            registrationId={satispayState.registrationId}
            onCancel={() => setSatispayState(null)}
            eventSlug={event.slug}
            price={totalPrice}
          />
        </div>
      </section>
    );
  }

  return (
    <section id="iscrizione" className="py-16 sm:py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-2 text-foreground">Iscriviti in coppia</h2>
        <p className="text-center text-muted-foreground mb-8">
          Iscrivi la tua coppia al prezzo di <span className="font-bold text-secondary">{formatPrice(totalPrice)}</span>
          <span className="text-xs ml-1">({formatPrice(unitPrice)} × 2)</span>
        </p>

        {/* Discipline choice — only if not preselected from EventPage */}
        {!preselectedDiscipline && routeField && routeField.options && (
          <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm mb-6">
            <CardContent className="pt-6 space-y-3">
              <Label className="text-sm font-medium">{routeField.label} *</Label>
              <RadioGroup value={routeSelection} onValueChange={setRouteSelection} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {routeField.options.map((opt) => {
                  const price = getOptionPrice(routeField, opt);
                  return (
                    <label
                      key={opt}
                      htmlFor={`disc-${opt}`}
                      className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-all ${routeSelection === opt ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                    >
                      <RadioGroupItem value={opt} id={`disc-${opt}`} />
                      <div className="flex-1">
                        <span className="text-sm font-medium">{opt}</span>
                        {price && (
                          <span className="block text-xs text-muted-foreground">{formatPrice(price)} a partecipante</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <PersonFormFields label="Componente A" person={personA} onChange={setPersonA} comuni={comuni} comuniLoading={comuniLoading} />
          <PersonFormFields label="Componente B" person={personB} onChange={setPersonB} comuni={comuni} comuniLoading={comuniLoading} />
        </div>

        {/* Payment method */}
        <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-5">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Metodo di pagamento *</Label>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {event.payment_methods.map((pm) => (
                  <label
                    key={pm}
                    htmlFor={`pay-pair-${pm}`}
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${paymentMethod === pm ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                  >
                    <RadioGroupItem value={pm} id={`pay-pair-${pm}`} />
                    {PAYMENT_ICONS[pm]}
                    <span className="text-sm font-medium">{PAYMENT_LABELS[pm] || pm}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Satispay payer selection */}
            {paymentMethod === "satispay" && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Chi paga? *</Label>
                <RadioGroup value={satispayPayer} onValueChange={(v) => setSatispayPayer(v as "each" | "a" | "b")} className="space-y-2">
                  <label
                    htmlFor="payer-each"
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${satispayPayer === "each" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                  >
                    <RadioGroupItem value="each" id="payer-each" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">Ognuno paga la sua quota</span>
                      <span className="block text-xs text-muted-foreground">
                        Verranno inviate due richieste Satispay da {formatPrice(unitPrice)} ciascuna
                      </span>
                    </div>
                  </label>
                  <label
                    htmlFor="payer-a"
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${satispayPayer === "a" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                  >
                    <RadioGroupItem value="a" id="payer-a" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">
                        Paga tutto {personA.nome || "Componente A"} {personA.cognome || ""}
                      </span>
                      {personA.telefono && !personA.returningUserData && (
                        <span className="block text-xs text-muted-foreground font-mono">
                          {obfuscatePhone(`${personA.countryCode}${personA.telefono.replace(/[\s\-()]/g, "").replace(/^\+\d{1,3}/, "")}`)}
                        </span>
                      )}
                      {personA.returningUserData && (
                        <span className="block text-xs text-muted-foreground font-mono">
                          {obfuscatePhone(personA.returningUserData.telefono)}
                        </span>
                      )}
                    </div>
                  </label>
                  <label
                    htmlFor="payer-b"
                    className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${satispayPayer === "b" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                  >
                    <RadioGroupItem value="b" id="payer-b" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">
                        Paga tutto {personB.nome || "Componente B"} {personB.cognome || ""}
                      </span>
                      {personB.telefono && !personB.returningUserData && (
                        <span className="block text-xs text-muted-foreground font-mono">
                          {obfuscatePhone(`${personB.countryCode}${personB.telefono.replace(/[\s\-()]/g, "").replace(/^\+\d{1,3}/, "")}`)}
                        </span>
                      )}
                      {personB.returningUserData && (
                        <span className="block text-xs text-muted-foreground font-mono">
                          {obfuscatePhone(personB.returningUserData.telefono)}
                        </span>
                      )}
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            <Button
              size="lg"
              className="w-full font-display font-semibold text-lg h-12"
              disabled={isSubmitting}
              onClick={onSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Elaborazione...
                </>
              ) : (
                `Iscriviti e Paga — ${formatPrice(totalPrice)}`
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default PairRegistrationForm;
