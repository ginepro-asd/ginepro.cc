import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsExpired } from "@/components/Countdown";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CreditCard, Smartphone, CircleDollarSign, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SatispayWaiting from "@/components/SatispayWaiting";

const formSchema = z.object({
  nome: z.string().trim().min(1, "Campo obbligatorio").max(100),
  cognome: z.string().trim().min(1, "Campo obbligatorio").max(100),
  email: z.string().trim().email("Email non valida").max(255),
  telefono: z.string().trim().min(6, "Numero non valido").max(20),
  identificationType: z.enum(["birth", "fiscal"]),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  codiceFiscale: z.string().optional(),
  paymentMethod: z.enum(["stripe", "satispay", "paypal"]),
}).refine(
  (data) => {
    if (data.identificationType === "birth") {
      return data.birthDate && data.birthDate.length > 0 && data.birthPlace && data.birthPlace.length > 0;
    }
    return data.codiceFiscale && data.codiceFiscale.length >= 11;
  },
  {
    message: "Compila i campi di identificazione",
    path: ["codiceFiscale"],
  }
);

type FormData = z.infer<typeof formSchema>;

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

const RegistrationForm = () => {
  const expired = useIsExpired();
  const [identificationType, setIdentificationType] = useState<"birth" | "fiscal">("birth");
  const [countryCode, setCountryCode] = useState("+39");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [satispayState, setSatispayState] = useState<{ paymentId: string; registrationId: string } | null>(null);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      telefono: "",
      identificationType: "birth",
      birthDate: "",
      birthPlace: "",
      codiceFiscale: "",
      paymentMethod: "stripe",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    // Strip any leading +/country code the user may have typed, then prepend the selected one
    const rawPhone = data.telefono.replace(/[\s\-()]/g, "").replace(/^\+\d{1,3}/, "");
    const fullPhone = `${countryCode}${rawPhone}`;

    const payload = {
      nome: data.nome,
      cognome: data.cognome,
      email: data.email,
      telefono: fullPhone,
      identificationType: data.identificationType,
      birthDate: data.birthDate || null,
      birthPlace: data.birthPlace || null,
      codiceFiscale: data.codiceFiscale || null,
    };

    try {
      if (data.paymentMethod === "stripe") {
        const { data: result, error } = await supabase.functions.invoke("create-checkout", {
          body: payload,
        });
        if (error) throw error;
        if (result?.url) {
          window.location.href = result.url;
        } else {
          throw new Error("Nessun URL di pagamento ricevuto");
        }
      } else if (data.paymentMethod === "satispay") {
        const { data: result, error } = await supabase.functions.invoke("create-satispay-payment", {
          body: payload,
        });
        if (error) throw error;
        if (result?.payment_id && result?.registration_id) {
          setSatispayState({
            paymentId: result.payment_id,
            registrationId: result.registration_id,
          });
        } else {
          throw new Error("Errore nella creazione del pagamento Satispay");
        }
      } else if (data.paymentMethod === "paypal") {
        const { data: result, error } = await supabase.functions.invoke("create-paypal-order", {
          body: payload,
        });
        if (error) throw error;
        if (result?.url) {
          window.location.href = result.url;
        } else {
          throw new Error("Nessun URL PayPal ricevuto");
        }
      }
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Errore durante la creazione del pagamento.",
        variant: "destructive",
      });
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
            <AlertDescription>
              Le iscrizioni early-bird sono terminate il 29 Marzo 2026 alle 23:59.
            </AlertDescription>
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
          />
        </div>
      </section>
    );
  }

  return (
    <section id="iscrizione" className="py-16 sm:py-24 px-4">
      <div className="max-w-xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-2 text-foreground">
          Iscriviti ora
        </h2>
        <p className="text-center text-muted-foreground mb-8">
          Assicurati il posto al prezzo early-bird di <span className="font-bold text-secondary">14,99€</span>
        </p>

        <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl">Dati di iscrizione</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Name row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="nome" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome *</FormLabel>
                      <FormControl><Input placeholder="Mario" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cognome" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cognome *</FormLabel>
                      <FormControl><Input placeholder="Rossi" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Contact */}
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl><Input type="email" placeholder="mario@email.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="telefono" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefono *</FormLabel>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="flex h-10 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-[90px] shrink-0"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.country} {c.code}
                          </option>
                        ))}
                      </select>
                      <FormControl>
                        <Input type="tel" placeholder="333 1234567" {...field} />
                      </FormControl>
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
                    <FormField control={form.control} name="codiceFiscale" render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="RSSMRA85M01H501Z" maxLength={16} className="uppercase" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="birthDate" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data di nascita</FormLabel>
                          <FormControl><Input type="date" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="birthPlace" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Luogo di nascita</FormLabel>
                          <FormControl><Input placeholder="Roma" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  )}
                </div>

                {/* Payment method */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Metodo di pagamento *</Label>
                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label htmlFor="pay-stripe" className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${field.value === "stripe" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}>
                            <RadioGroupItem value="stripe" id="pay-stripe" />
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Carta</span>
                          </label>
                          <label htmlFor="pay-satispay" className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${field.value === "satispay" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}>
                            <RadioGroupItem value="satispay" id="pay-satispay" />
                            <Smartphone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Satispay</span>
                          </label>
                          <label htmlFor="pay-paypal" className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${field.value === "paypal" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}>
                            <RadioGroupItem value="paypal" id="pay-paypal" />
                            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">PayPal</span>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <Button type="submit" size="lg" className="w-full font-display font-semibold text-lg h-12" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Elaborazione...
                    </>
                  ) : (
                    "Iscriviti e Paga — 14,99€"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default RegistrationForm;
