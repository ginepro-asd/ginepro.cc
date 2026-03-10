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
import { CreditCard, Smartphone, CircleDollarSign, Lock, Loader2, Calculator, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SatispayWaiting from "@/components/SatispayWaiting";
import SearchableSelect from "@/components/SearchableSelect";
import { useItalianComuni } from "@/hooks/use-italian-comuni";
import { COUNTRIES } from "@/data/countries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventData, CustomField } from "@/hooks/use-event";
import { formatPrice } from "@/hooks/use-event";
import CodiceFiscale from "codice-fiscale-js";

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
}

const emptyPerson = (): PersonState => ({
  nome: "", cognome: "", email: "", telefono: "",
  countryCode: "+39", identificationType: "birth",
  birthDate: "", birthPlace: "", gender: "", codiceFiscale: "",
  bornAbroad: false, computedCF: null,
});

const DISCIPLINE_PRICES: Record<string, number> = {
  "Staffetta": 800,
  "Eco-camminata": 500,
};

interface PairRegistrationFormProps {
  event: EventData;
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
  const update = (fields: Partial<PersonState>) => {
    const next = { ...person, ...fields };
    // Auto-compute CF
    if (next.identificationType === "birth" && next.nome && next.cognome && next.birthDate && next.birthPlace && next.gender) {
      next.computedCF = tryComputeCF(next.nome, next.cognome, next.birthDate, next.birthPlace, next.gender as "M" | "F", next.bornAbroad);
      if (next.computedCF) next.codiceFiscale = next.computedCF;
    }
    onChange(next);
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
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

        {/* Email */}
        <div className="space-y-1.5">
          <Label className="text-sm">Email *</Label>
          <Input type="email" placeholder="mario@email.com" value={person.email} onChange={(e) => update({ email: e.target.value })} />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label className="text-sm">Telefono *</Label>
          <div className="flex gap-2">
            <select
              value={person.countryCode}
              onChange={(e) => update({ countryCode: e.target.value })}
              className="flex h-10 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-[90px] shrink-0"
            >
              {COUNTRY_CODES.map((c) => (
                <option key={c.code} value={c.code}>{c.country} {c.code}</option>
              ))}
            </select>
            <Input type="tel" placeholder="333 1234567" value={person.telefono} onChange={(e) => update({ telefono: e.target.value })} />
          </div>
        </div>

        {/* Identification */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Identificazione *</Label>
          <RadioGroup
            value={person.identificationType}
            onValueChange={(v) => update({ identificationType: v as "birth" | "fiscal", computedCF: null })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="birth" id={`birth-${label}`} />
              <Label htmlFor={`birth-${label}`} className="cursor-pointer">Data/Luogo di nascita</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="fiscal" id={`fiscal-${label}`} />
              <Label htmlFor={`fiscal-${label}`} className="cursor-pointer">Codice Fiscale</Label>
            </div>
          </RadioGroup>

          {person.identificationType === "fiscal" ? (
            <div className="space-y-1.5">
              <Input
                placeholder="RSSMRA85M01H501Z"
                maxLength={16}
                className="uppercase"
                value={person.codiceFiscale}
                onChange={(e) => update({ codiceFiscale: e.target.value.toUpperCase() })}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`abroad-${label}`}
                  checked={person.bornAbroad}
                  onCheckedChange={(checked) => update({ bornAbroad: !!checked, birthPlace: "" })}
                />
                <Label htmlFor={`abroad-${label}`} className="cursor-pointer text-sm text-muted-foreground">Nato/a all'estero</Label>
              </div>

              {/* Gender */}
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
                  <SearchableSelect
                    options={person.bornAbroad ? COUNTRIES : comuni}
                    value={person.birthPlace}
                    onChange={(v) => update({ birthPlace: v })}
                    placeholder={person.bornAbroad ? "Seleziona nazione..." : "Seleziona comune..."}
                    searchPlaceholder={person.bornAbroad ? "Cerca nazione..." : "Cerca comune..."}
                    emptyMessage="Nessun risultato trovato."
                    loading={!person.bornAbroad && comuniLoading}
                  />
                </div>
              </div>

              {person.computedCF && (
                <div className="bg-muted/50 border border-border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                    <Calculator className="h-3.5 w-3.5" />
                    Codice Fiscale calcolato
                  </div>
                  <p className="font-mono text-sm font-semibold text-foreground tracking-wider">{person.computedCF}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const PairRegistrationForm = ({ event }: PairRegistrationFormProps) => {
  const deadline = event.scadenza_iscrizioni ? new Date(event.scadenza_iscrizioni) : new Date("2099-12-31");
  const expired = useIsExpired(deadline);
  const { comuni, loading: comuniLoading } = useItalianComuni();
  const [personA, setPersonA] = useState<PersonState>(emptyPerson());
  const [personB, setPersonB] = useState<PersonState>(emptyPerson());
  const [paymentMethod, setPaymentMethod] = useState<string>(event.payment_methods[0] || "stripe");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [satispayState, setSatispayState] = useState<{ paymentId: string; registrationId: string } | null>(null);
  const { toast } = useToast();

  // Discipline selection (from custom_fields)
  const disciplinaField = event.custom_fields.find((f) => f.key === "disciplina");
  const [disciplina, setDisciplina] = useState<string>(disciplinaField?.options?.[0] || "");
  const unitPrice = disciplina && DISCIPLINE_PRICES[disciplina] ? DISCIPLINE_PRICES[disciplina] : event.prezzo;
  const totalPrice = unitPrice * 2;

  const validatePerson = (p: PersonState, label: string): string | null => {
    if (!p.nome.trim()) return `${label}: Nome è obbligatorio`;
    if (!p.cognome.trim()) return `${label}: Cognome è obbligatorio`;
    if (!p.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return `${label}: Email non valida`;
    if (!p.telefono.trim() || p.telefono.length < 6) return `${label}: Telefono non valido`;
    if (p.identificationType === "birth") {
      if (!p.birthDate || !p.birthPlace || !p.gender) return `${label}: Compila data, luogo di nascita e sesso`;
    } else {
      if (!p.codiceFiscale || p.codiceFiscale.length < 11) return `${label}: Codice Fiscale non valido`;
    }
    return null;
  };

  const buildPayload = (p: PersonState) => ({
    nome: p.nome.trim(),
    cognome: p.cognome.trim(),
    email: p.email.trim(),
    telefono: `${p.countryCode}${p.telefono.replace(/[\s\-()]/g, "").replace(/^\+\d{1,3}/, "")}`,
    identificationType: p.identificationType,
    birthDate: p.birthDate || null,
    birthPlace: p.birthPlace || null,
    codiceFiscale: p.codiceFiscale || p.computedCF || null,
  });

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
        customData: { disciplina },
        disciplina,
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
          setSatispayState({ paymentId: result.payment_id, registrationId: result.registration_id });
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
            <AlertTitle className="font-display text-lg">Iscrizioni chiuse</AlertTitle>
            <AlertDescription>Le iscrizioni sono terminate.</AlertDescription>
          </Alert>
        </div>
      </section>
    );
  }

  if (satispayState) {
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
          <span className="text-xs ml-1">({formatPrice(event.prezzo)} × 2)</span>
        </p>

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
