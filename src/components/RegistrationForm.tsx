import { useState, useEffect } from "react";
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
import { CreditCard, Smartphone, CircleDollarSign, Lock, Loader2, Calculator } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SatispayWaiting from "@/components/SatispayWaiting";
import SearchableSelect from "@/components/SearchableSelect";
import { useItalianComuni } from "@/hooks/use-italian-comuni";
import { COUNTRIES } from "@/data/countries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { EventData, CustomField } from "@/hooks/use-event";
import { formatPrice } from "@/hooks/use-event";
import {
  getOptionPrice,
  getPricingField,
  getSelectedPrice,
  getStartingPrice,
  hasVariablePricing,
} from "@/lib/event-pricing";
import {
  COUNTRY_CODES,
  PAYMENT_LABELS,
  tryComputeCF,
  tryInverseCF,
} from "@/lib/registration-utils";
import { useReturningUser } from "@/hooks/use-returning-user";
import ReturningUserDialog from "@/components/ReturningUserDialog";

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-4 w-4 text-muted-foreground" />,
  satispay: <Smartphone className="h-4 w-4 text-muted-foreground" />,
  paypal: <CircleDollarSign className="h-4 w-4 text-muted-foreground" />,
};

const formSchema = z.object({
  nome: z.string().trim().min(1, "Campo obbligatorio").max(100),
  cognome: z.string().trim().min(1, "Campo obbligatorio").max(100),
  email: z.string().trim().min(1, "Campo obbligatorio").max(255),
  telefono: z.string().trim().min(6, "Numero non valido").max(20),
  identificationType: z.enum(["birth", "fiscal"]),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  gender: z.enum(["M", "F"]).optional(),
  codiceFiscale: z.string().optional(),
  paymentMethod: z.enum(["stripe", "satispay", "paypal"]),
}).refine(
  (data) => {
    if (data.identificationType === "birth") {
      return data.birthDate && data.birthDate.length > 0 && data.birthPlace && data.birthPlace.length > 0 && data.gender;
    }
    return data.codiceFiscale && data.codiceFiscale.length >= 11;
  },
  {
    message: "Compila i campi di identificazione",
    path: ["codiceFiscale"],
  }
);

type FormData = z.infer<typeof formSchema>;

interface RegistrationFormProps {
  event: EventData;
  preselectedDiscipline?: string;
}

const RegistrationForm = ({ event, preselectedDiscipline }: RegistrationFormProps) => {
  const deadline = event.scadenza_iscrizioni ? new Date(event.scadenza_iscrizioni) : new Date("2099-12-31");
  const expired = useIsExpired(deadline);
  const { comuni, loading: comuniLoading } = useItalianComuni();
  const [identificationType, setIdentificationType] = useState<"birth" | "fiscal">("birth");
  const [countryCode, setCountryCode] = useState("+39");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bornAbroad, setBornAbroad] = useState(false);
  const [satispayState, setSatispayState] = useState<{ paymentId: string; registrationId: string } | null>(null);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [computedCF, setComputedCF] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{ birthDate: string; birthPlace: string; birthPlaceProvincia: string; gender: "M" | "F" } | null>(null);
  const { toast } = useToast();
  const pricingField = getPricingField(event.custom_fields);
  const hasEventVariablePricing = hasVariablePricing(event.custom_fields);
  const selectedPrice = getSelectedPrice(event.prezzo, event.custom_fields, customFieldValues);
  const startingPrice = getStartingPrice(event.prezzo, event.custom_fields);
  const selectedPricingOption = pricingField ? customFieldValues[pricingField.key] : undefined;
  const displayPrice = hasEventVariablePricing && !selectedPricingOption ? startingPrice : selectedPrice;
  const displayPriceLabel = hasEventVariablePricing && !selectedPricingOption ? `da ${formatPrice(displayPrice)}` : formatPrice(displayPrice);

  const defaultPayment = event.payment_methods[0] || "stripe";

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "", cognome: "", email: "", telefono: "",
      identificationType: "birth", birthDate: "", birthPlace: "",
      gender: undefined, codiceFiscale: "",
      paymentMethod: defaultPayment as "stripe" | "satispay" | "paypal",
    },
  });

  const watchedNome = form.watch("nome");
  const watchedCognome = form.watch("cognome");
  const watchedBirthDate = form.watch("birthDate");
  const watchedBirthPlace = form.watch("birthPlace");
  const watchedGender = form.watch("gender");
  const watchedCF = form.watch("codiceFiscale");

  const {
    matchedUsers, showMatchDialog, setShowMatchDialog,
    returningUserData, handleSelectMatch, handleDismiss,
  } = useReturningUser({
    watchedNome, watchedCognome, form, setCountryCode, setIdentificationType,
  });

  // Auto-compute CF from birth data
  useEffect(() => {
    if (identificationType !== "birth") return;
    if (!watchedNome || !watchedCognome || !watchedBirthDate || !watchedBirthPlace || !watchedGender) {
      setComputedCF(null);
      return;
    }
    const cf = tryComputeCF(watchedNome, watchedCognome, watchedBirthDate, watchedBirthPlace, watchedGender, bornAbroad);
    setComputedCF(cf);
    if (cf) form.setValue("codiceFiscale", cf);
  }, [identificationType, watchedNome, watchedCognome, watchedBirthDate, watchedBirthPlace, watchedGender, bornAbroad]);

  // Auto-extract birth data from CF
  useEffect(() => {
    if (identificationType !== "fiscal") return;
    if (!watchedCF || watchedCF.length < 16) { setExtractedData(null); return; }
    const data = tryInverseCF(watchedCF);
    setExtractedData(data);
    if (data) {
      form.setValue("birthDate", data.birthDate);
      form.setValue("birthPlace", data.birthPlace);
      form.setValue("gender", data.gender);
    }
  }, [identificationType, watchedCF]);

  const onSubmit = async (data: FormData) => {
    for (const field of event.custom_fields) {
      if (field.required && !customFieldValues[field.key]) {
        toast({ title: "Errore", description: `${field.label} è obbligatorio`, variant: "destructive" });
        return;
      }
    }
    if (!returningUserData && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      toast({ title: "Errore", description: "Email non valida", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const realEmail = returningUserData ? returningUserData.email : data.email;
    const realPhone = returningUserData ? returningUserData.telefono : `${countryCode}${data.telefono.replace(/[\s\-()]/g, "").replace(/^\+\d{1,3}/, "")}`;
    const realCF = returningUserData?.codice_fiscale || data.codiceFiscale || computedCF || null;

    const payload = {
      nome: data.nome, cognome: data.cognome, email: realEmail, telefono: realPhone,
      identificationType: data.identificationType,
      birthDate: data.birthDate || null, birthPlace: data.birthPlace || null,
      codiceFiscale: realCF, eventId: event.id, customData: customFieldValues,
    };

    try {
      if (data.paymentMethod === "stripe") {
        const { data: result, error } = await supabase.functions.invoke("create-checkout", { body: payload });
        if (error) throw error;
        if (result?.url) window.location.href = result.url;
        else throw new Error("Nessun URL di pagamento ricevuto");
      } else if (data.paymentMethod === "satispay") {
        const { data: result, error } = await supabase.functions.invoke("create-satispay-payment", { body: payload });
        if (error) throw error;
        if (result?.payment_id && result?.registration_id) {
          setSatispayState({ paymentId: result.payment_id, registrationId: result.registration_id });
        } else throw new Error("Errore nella creazione del pagamento Satispay");
      } else if (data.paymentMethod === "paypal") {
        const { data: result, error } = await supabase.functions.invoke("create-paypal-order", { body: payload });
        if (error) throw error;
        if (result?.url) window.location.href = result.url;
        else throw new Error("Nessun URL PayPal ricevuto");
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
            price={selectedPrice}
          />
        </div>
      </section>
    );
  }

  return (
    <section id="iscrizione" className="py-16 sm:py-24 px-4">
      <div className="max-w-xl mx-auto">
        <ReturningUserDialog
          open={showMatchDialog}
          onOpenChange={setShowMatchDialog}
          matchedUsers={matchedUsers}
          onSelect={handleSelectMatch}
          onDismiss={handleDismiss}
        />
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-2 text-foreground">Iscriviti ora</h2>
        <p className="text-center text-muted-foreground mb-8">
          Assicurati il posto al prezzo di <span className="font-bold text-secondary">{displayPriceLabel}</span>
        </p>

        <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl">Dati di iscrizione</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem><FormLabel>Nome *</FormLabel><FormControl><Input placeholder="Mario" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cognome" render={({ field }) => (
                    <FormItem><FormLabel>Cognome *</FormLabel><FormControl><Input placeholder="Rossi" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email *</FormLabel><FormControl><Input type={returningUserData ? "text" : "email"} placeholder="mario@email.com" readOnly={!!returningUserData} className={returningUserData ? "bg-muted/50 cursor-not-allowed" : ""} {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="telefono" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono *</FormLabel>
                    <div className="flex gap-2">
                      <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="flex h-10 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-[90px] shrink-0">
                        {COUNTRY_CODES.map((c) => (<option key={c.code} value={c.code}>{c.country} {c.code}</option>))}
                      </select>
                      <FormControl><Input type="tel" placeholder="333 1234567" readOnly={!!returningUserData} className={returningUserData ? "bg-muted/50 cursor-not-allowed" : ""} {...field} /></FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Identification type */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Identificazione *</Label>
                  <RadioGroup
                    value={identificationType}
                    onValueChange={(v) => {
                      setIdentificationType(v as "birth" | "fiscal");
                      form.setValue("identificationType", v as "birth" | "fiscal");
                      setComputedCF(null);
                      setExtractedData(null);
                    }}
                    className="flex gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="birth" id="birth" />
                      <Label htmlFor="birth" className="cursor-pointer">Data/Luogo di nascita</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="fiscal" id="fiscal" />
                      <Label htmlFor="fiscal" className="cursor-pointer">Codice Fiscale</Label>
                    </div>
                  </RadioGroup>

                  {identificationType === "fiscal" ? (
                    <div className="space-y-3">
                      <FormField control={form.control} name="codiceFiscale" render={({ field }) => (
                        <FormItem><FormControl><Input placeholder="RSSMRA85M01H501Z" maxLength={16} className={`uppercase ${returningUserData?.codice_fiscale ? "bg-muted/50 cursor-not-allowed" : ""}`} readOnly={!!returningUserData?.codice_fiscale} {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      {extractedData && (
                        <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                            <Calculator className="h-3.5 w-3.5" />Dati estratti dal Codice Fiscale
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div><span className="text-muted-foreground">Nato/a il: </span><span className="font-medium text-foreground">{new Date(extractedData.birthDate).toLocaleDateString("it-IT")}</span></div>
                            <div><span className="text-muted-foreground">Sesso: </span><span className="font-medium text-foreground">{extractedData.gender}</span></div>
                            <div className="col-span-2"><span className="text-muted-foreground">Luogo: </span><span className="font-medium text-foreground">{extractedData.birthPlace}{extractedData.birthPlaceProvincia && extractedData.birthPlaceProvincia !== "EE" ? ` (${extractedData.birthPlaceProvincia})` : ""}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Checkbox id="born-abroad" checked={bornAbroad} onCheckedChange={(checked) => { setBornAbroad(!!checked); form.setValue("birthPlace", ""); }} />
                        <Label htmlFor="born-abroad" className="cursor-pointer text-sm text-muted-foreground">Nato/a all'estero</Label>
                      </div>
                      <FormField control={form.control} name="gender" render={({ field }) => (
                        <FormItem><FormLabel>Sesso *</FormLabel><FormControl>
                          <RadioGroup value={field.value || ""} onValueChange={field.onChange} className="flex gap-4">
                            <div className="flex items-center gap-2"><RadioGroupItem value="M" id="gender-m" /><Label htmlFor="gender-m" className="cursor-pointer">M</Label></div>
                            <div className="flex items-center gap-2"><RadioGroupItem value="F" id="gender-f" /><Label htmlFor="gender-f" className="cursor-pointer">F</Label></div>
                          </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                      )} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField control={form.control} name="birthDate" render={({ field }) => (
                          <FormItem><FormLabel>Data di nascita</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="birthPlace" render={({ field }) => (
                          <FormItem><FormLabel>{bornAbroad ? "Nazione di nascita" : "Comune di nascita"}</FormLabel><FormControl>
                            <SearchableSelect options={bornAbroad ? COUNTRIES : comuni} value={field.value || ""} onChange={(v) => field.onChange(v)} placeholder={bornAbroad ? "Seleziona nazione..." : "Seleziona comune..."} searchPlaceholder={bornAbroad ? "Cerca nazione..." : "Cerca comune..."} emptyMessage="Nessun risultato trovato." loading={!bornAbroad && comuniLoading} />
                          </FormControl><FormMessage /></FormItem>
                        )} />
                      </div>
                      {computedCF && (
                        <div className="bg-muted/50 border border-border rounded-lg p-3">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1"><Calculator className="h-3.5 w-3.5" />Codice Fiscale calcolato</div>
                          <p className="font-mono text-sm font-semibold text-foreground tracking-wider">{computedCF}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Custom fields */}
                {event.custom_fields.length > 0 && (
                  <div className="space-y-4 border-t border-border/50 pt-5">
                    <Label className="text-sm font-medium">Informazioni aggiuntive</Label>
                    {event.custom_fields.map((cf) => (
                      <CustomFieldInput key={cf.key} field={cf} value={customFieldValues[cf.key] || ""} onChange={(v) => setCustomFieldValues((prev) => ({ ...prev, [cf.key]: v }))} />
                    ))}
                  </div>
                )}

                {/* Payment method */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Metodo di pagamento *</Label>
                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem><FormControl>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {event.payment_methods.map((pm) => (
                          <label key={pm} htmlFor={`pay-${pm}`} className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${field.value === pm ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}>
                            <RadioGroupItem value={pm} id={`pay-${pm}`} />
                            {PAYMENT_ICONS[pm]}
                            <span className="text-sm font-medium">{PAYMENT_LABELS[pm] || pm}</span>
                          </label>
                        ))}
                      </RadioGroup>
                    </FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <Button type="submit" size="lg" className="w-full font-display font-semibold text-lg h-12" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Elaborazione...</>) : `Iscriviti e Paga — ${displayPriceLabel}`}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

function CustomFieldInput({ field, value, onChange }: { field: CustomField; value: string; onChange: (v: string) => void }) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  if (field.type === "select" && field.options) {
    const hasOptionPrices = field.options.some((opt) => getOptionPrice(field, opt) !== null);
    return (
      <div className="space-y-1.5">
        <Label className="text-sm">{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={`Seleziona ${field.label.toLowerCase()}...`} /></SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => {
              const optionPrice = getOptionPrice(field, opt);
              return (<SelectItem key={opt} value={opt}>{opt}{optionPrice !== null ? ` - ${formatPrice(optionPrice)}` : ""}</SelectItem>);
            })}
          </SelectContent>
        </Select>
        {hasOptionPrices && <p className="text-xs text-muted-foreground">Seleziona l&apos;opzione per aggiornare il prezzo finale.</p>}
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={field.key} checked={value === "true"} onCheckedChange={(c) => onChange(c ? "true" : "false")} />
        <Label htmlFor={field.key} className="cursor-pointer text-sm">{label}</Label>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Input type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder || ""} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default RegistrationForm;
