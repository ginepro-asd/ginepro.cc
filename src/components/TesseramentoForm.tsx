import { useState, useEffect, useCallback } from "react";
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
import { CreditCard, Smartphone, CircleDollarSign, Lock, Loader2, Calculator, Camera, FileCheck, AlertTriangle, Check, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SatispayWaiting from "@/components/SatispayWaiting";
import SearchableSelect from "@/components/SearchableSelect";
import { useItalianComuni } from "@/hooks/use-italian-comuni";
import { COUNTRIES } from "@/data/countries";
import type { EventData } from "@/hooks/use-event";
import { formatPrice } from "@/hooks/use-event";
import { COUNTRY_CODES, PAYMENT_LABELS, tryComputeCF, tryInverseCF, ExistingCertificate } from "@/lib/registration-utils";
import { useReturningUser } from "@/hooks/use-returning-user";
import ReturningUserDialog from "@/components/ReturningUserDialog";
import SignaturePad from "@/components/SignaturePad";

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  stripe: <CreditCard className="h-4 w-4 text-muted-foreground" />,
  satispay: <Smartphone className="h-4 w-4 text-muted-foreground" />,
  paypal: <CircleDollarSign className="h-4 w-4 text-muted-foreground" />,
};

const MEMBERSHIP_OPTIONS = [
  { value: "fidal-running", label: "FIDAL Running", price: 4000, disciplines: ["atletica leggera"] },
  { value: "fidal-running-uisp-bike", label: "FIDAL Running + UISP Bike", price: 8000, disciplines: ["atletica leggera", "ciclismo"] },
  { value: "socio-sostenitore", label: "Socio sostenitore", price: 1500, disciplines: [] },
  { value: "uisp-bike", label: "UISP Bike", price: 5500, disciplines: ["ciclismo"] },
  { value: "uisp-running", label: "UISP Running", price: 2500, disciplines: ["atletica leggera"] },
  { value: "uisp-running-bike", label: "UISP Running + Bike", price: 6500, disciplines: ["atletica leggera", "ciclismo"] },
];

const STEP_LABELS = ["Identificazione", "Tipologia", "Fototessera", "Firma", "Certificato", "Pagamento"];

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
  { message: "Compila i campi di identificazione", path: ["codiceFiscale"] }
);

type FormData = z.infer<typeof formSchema>;

interface TesseramentoFormProps {
  event: EventData;
}

const TesseramentoForm = ({ event }: TesseramentoFormProps) => {
  const deadline = event.scadenza_iscrizioni ? new Date(event.scadenza_iscrizioni) : new Date("2099-12-31");
  const expired = useIsExpired(deadline);
  const { comuni, loading: comuniLoading } = useItalianComuni();
  const [step, setStep] = useState(0);
  const [identificationType, setIdentificationType] = useState<"birth" | "fiscal">("birth");
  const [countryCode, setCountryCode] = useState("+39");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bornAbroad, setBornAbroad] = useState(false);
  const [satispayState, setSatispayState] = useState<{ paymentId: string; registrationId: string } | null>(null);
  const [computedCF, setComputedCF] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<{ birthDate: string; birthPlace: string; birthPlaceProvincia: string; gender: "M" | "F" } | null>(null);
  const { toast } = useToast();

  // Membership-specific state
  const [membershipType, setMembershipType] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [useExistingPhoto, setUseExistingPhoto] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<{ file: File; discipline: string; analysis?: any; analyzing?: boolean }[]>([]);
  const [skipCertificate, setSkipCertificate] = useState(false);
  const [keptCertificates, setKeptCertificates] = useState<Record<string, ExistingCertificate>>({}); // discipline -> existing cert

  const selectedOption = MEMBERSHIP_OPTIONS.find((o) => o.value === membershipType);
  const requiredDisciplines = selectedOption?.disciplines || [];
  const isSocioSostenitore = membershipType === "socio-sostenitore";

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
    returningUserData, existingCertificates, handleSelectMatch, handleDismiss,
  } = useReturningUser({ watchedNome, watchedCognome, form, setCountryCode, setIdentificationType });

  // When returning user is selected, pre-populate photo if available
  useEffect(() => {
    if (returningUserData?.photo_thumb_url || returningUserData?.photo_url) {
      setPhotoPreview(returningUserData.photo_thumb_url || returningUserData.photo_url);
      setUseExistingPhoto(true);
    }
  }, [returningUserData]);

  // When returning user has valid certificates, auto-keep them for matching disciplines
  useEffect(() => {
    if (existingCertificates.length > 0 && requiredDisciplines.length > 0) {
      const kept: Record<string, ExistingCertificate> = {};
      for (const discipline of requiredDisciplines) {
        const match = existingCertificates.find(
          (c) => c.disciplines?.some((d) => d.toLowerCase() === discipline.toLowerCase())
        );
        if (match) kept[discipline] = match;
      }
      setKeptCertificates(kept);
    }
  }, [existingCertificates, membershipType]);

  // Auto-compute CF from birth data
  useEffect(() => {
    if (identificationType !== "birth") return;
    if (!watchedNome || !watchedCognome || !watchedBirthDate || !watchedBirthPlace || !watchedGender) { setComputedCF(null); return; }
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

  // Compute active steps (skip certificate for socio sostenitore)
  const activeSteps = isSocioSostenitore
    ? STEP_LABELS.filter((_, i) => i !== 4)
    : STEP_LABELS;
  const totalSteps = activeSteps.length;

  // Map step index to real step
  const getRealStep = (visibleStep: number) => {
    if (!isSocioSostenitore) return visibleStep;
    // Steps: 0,1,2,3,5 (skip 4)
    if (visibleStep <= 3) return visibleStep;
    return visibleStep + 1; // 4→5
  };
  const realStep = getRealStep(step);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const generateThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 200 / Math.max(img.width, img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Thumbnail generation failed")), "image/jpeg", 0.85);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const analyzeCertificate = async (file: File, discipline: string, index: number) => {
    setCertificates((prev) => prev.map((c, i) => i === index ? { ...c, analyzing: true } : c));
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("analyze-certificate", {
        body: { fileBase64: base64, fileName: file.name, mimeType: file.type, expectedDiscipline: discipline },
      });

      if (error) throw error;
      setCertificates((prev) => prev.map((c, i) => i === index ? { ...c, analysis: data, analyzing: false } : c));
    } catch (err: any) {
      setCertificates((prev) => prev.map((c, i) => i === index ? { ...c, analyzing: false, analysis: { warning: "Analisi non riuscita: " + (err.message || "errore sconosciuto") } } : c));
    }
  };

  const handleCertificateUpload = (discipline: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const existingIndex = certificates.findIndex((c) => c.discipline === discipline);
    if (existingIndex >= 0) {
      setCertificates((prev) => prev.map((c, i) => i === existingIndex ? { file, discipline } : c));
      analyzeCertificate(file, discipline, existingIndex);
    } else {
      setCertificates((prev) => [...prev, { file, discipline }]);
      analyzeCertificate(file, discipline, certificates.length);
    }
  };

  const canProceed = () => {
    switch (realStep) {
      case 0: // Identification
        const values = form.getValues();
        if (!values.nome || !values.cognome || !values.email || !values.telefono) return false;
        if (values.identificationType === "birth") {
          return !!(values.birthDate && values.birthPlace && values.gender);
        }
        return !!(values.codiceFiscale && values.codiceFiscale.length >= 11);
      case 1: return !!membershipType;
      case 2: return !!photoFile || useExistingPhoto;
      case 3: return !!signatureData;
      case 4: {
        if (skipCertificate) return true;
        // Each required discipline must have either a new upload or a kept existing cert
        return requiredDisciplines.every((d) => certificates.some((c) => c.discipline === d) || keptCertificates[d]);
      }
      case 5: return true;
      default: return false;
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!returningUserData && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      toast({ title: "Errore", description: "Email non valida", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    try {
      const realEmail = returningUserData ? returningUserData.email : data.email;
      const realPhone = returningUserData ? returningUserData.telefono : `${countryCode}${data.telefono.replace(/[\s\-()]/g, "").replace(/^\+\d{1,3}/, "")}`;
      const realCF = returningUserData?.codice_fiscale || data.codiceFiscale || computedCF || null;

      // Upload photo (or reuse existing)
      let photoUrl = "";
      let photoThumbUrl = "";
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const photoPath = `${Date.now()}-${Math.random().toString(36).slice(2)}/original.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("member-photos").upload(photoPath, photoFile);
        if (uploadErr) throw new Error("Errore upload foto: " + uploadErr.message);
        const { data: urlData } = supabase.storage.from("member-photos").getPublicUrl(photoPath);
        photoUrl = urlData.publicUrl;

        // Generate and upload thumbnail
        const thumbBlob = await generateThumbnail(photoFile);
        const thumbPath = photoPath.replace(`/original.${ext}`, "/thumb.jpg");
        await supabase.storage.from("member-photos").upload(thumbPath, thumbBlob);
        const { data: thumbUrlData } = supabase.storage.from("member-photos").getPublicUrl(thumbPath);
        photoThumbUrl = thumbUrlData.publicUrl;
      } else if (useExistingPhoto && returningUserData) {
        photoUrl = returningUserData.photo_url || "";
        photoThumbUrl = returningUserData.photo_thumb_url || "";
      }

      // Upload signature
      let signatureUrl = "";
      if (signatureData) {
        const sigBlob = await (await fetch(signatureData)).blob();
        const sigPath = `${Date.now()}-${Math.random().toString(36).slice(2)}/signature.png`;
        const { error: sigErr } = await supabase.storage.from("member-signatures").upload(sigPath, sigBlob);
        if (sigErr) throw new Error("Errore upload firma: " + sigErr.message);
        const { data: sigUrlData } = supabase.storage.from("member-signatures").getPublicUrl(sigPath);
        signatureUrl = sigUrlData.publicUrl;
      }

      // Upload certificates
      const certPaths: string[] = [];
      for (const cert of certificates) {
        const certPath = `${Date.now()}-${Math.random().toString(36).slice(2)}/${cert.file.name}`;
        const { error: certErr } = await supabase.storage.from("medical-certificates").upload(certPath, cert.file);
        if (certErr) throw new Error("Errore upload certificato: " + certErr.message);
        certPaths.push(certPath);
      }

      const payload = {
        nome: data.nome, cognome: data.cognome, email: realEmail, telefono: realPhone,
        identificationType: data.identificationType,
        birthDate: data.birthDate || null, birthPlace: data.birthPlace || null,
        codiceFiscale: realCF, eventId: event.id,
        customData: {
          membershipType,
          membershipLabel: selectedOption?.label,
        },
        photoUrl, photoThumbUrl, signatureUrl,
        certificatePaths: certPaths,
        certificateAnalyses: [
          ...certificates.map((c) => ({
            discipline: c.discipline,
            expiryDate: c.analysis?.expiry_date || null,
            disciplines: c.analysis?.disciplines || [],
            warning: c.analysis?.warning || c.analysis?.ai_warning || null,
          })),
          ...Object.entries(keptCertificates).map(([discipline, kc]) => ({
            discipline,
            expiryDate: kc.expiry_date || null,
            disciplines: kc.disciplines || [],
            warning: kc.ai_warning || null,
            existingCertificateId: kc.id,
          })),
        ],
        isTesseramento: true,
      };

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
      toast({ title: "Errore", description: err.message || "Errore durante l'iscrizione.", variant: "destructive" });
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
            <AlertTitle className="font-display text-lg">Tesseramento chiuso</AlertTitle>
            <AlertDescription>Il periodo di tesseramento è terminato.</AlertDescription>
          </Alert>
        </div>
      </section>
    );
  }

  if (satispayState) {
    return (
      <section id="iscrizione" className="py-16 sm:py-24 px-4">
        <div className="max-w-xl mx-auto">
          <SatispayWaiting paymentId={satispayState.paymentId} registrationId={satispayState.registrationId} onCancel={() => setSatispayState(null)} eventSlug={event.slug} price={selectedOption?.price || 0} />
        </div>
      </section>
    );
  }

  return (
    <section id="iscrizione" className="py-16 sm:py-24 px-4">
      <div className="max-w-xl mx-auto">
        <ReturningUserDialog open={showMatchDialog} onOpenChange={setShowMatchDialog} matchedUsers={matchedUsers} onSelect={handleSelectMatch} onDismiss={handleDismiss} />

        <h2 className="font-display text-3xl sm:text-4xl font-bold text-center mb-2 text-foreground">Tesseramento {new Date().getFullYear()}</h2>
        <p className="text-center text-muted-foreground mb-8">Compila il modulo per tesserarti con GINEPRO</p>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {activeSteps.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < activeSteps.length - 1 && <div className={`w-6 sm:w-10 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl">{activeSteps[step]}</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Step 0: Identification */}
                {realStep === 0 && (
                  <>
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
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Identificazione *</Label>
                      <RadioGroup value={identificationType} onValueChange={(v) => { setIdentificationType(v as "birth" | "fiscal"); form.setValue("identificationType", v as "birth" | "fiscal"); setComputedCF(null); setExtractedData(null); }} className="flex gap-4">
                        <div className="flex items-center gap-2"><RadioGroupItem value="birth" id="t-birth" /><Label htmlFor="t-birth" className="cursor-pointer">Data/Luogo di nascita</Label></div>
                        <div className="flex items-center gap-2"><RadioGroupItem value="fiscal" id="t-fiscal" /><Label htmlFor="t-fiscal" className="cursor-pointer">Codice Fiscale</Label></div>
                      </RadioGroup>
                      {identificationType === "fiscal" ? (
                        <div className="space-y-3">
                          <FormField control={form.control} name="codiceFiscale" render={({ field }) => (
                            <FormItem><FormControl><Input placeholder="RSSMRA85M01H501Z" maxLength={16} className={`uppercase ${returningUserData?.codice_fiscale ? "bg-muted/50 cursor-not-allowed" : ""}`} readOnly={!!returningUserData?.codice_fiscale} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          {extractedData && (
                            <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1"><Calculator className="h-3.5 w-3.5" />Dati estratti dal Codice Fiscale</div>
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
                            <Checkbox id="t-born-abroad" checked={bornAbroad} onCheckedChange={(checked) => { setBornAbroad(!!checked); form.setValue("birthPlace", ""); }} />
                            <Label htmlFor="t-born-abroad" className="cursor-pointer text-sm text-muted-foreground">Nato/a all'estero</Label>
                          </div>
                          <FormField control={form.control} name="gender" render={({ field }) => (
                            <FormItem><FormLabel>Sesso *</FormLabel><FormControl>
                              <RadioGroup value={field.value || ""} onValueChange={field.onChange} className="flex gap-4">
                                <div className="flex items-center gap-2"><RadioGroupItem value="M" id="t-gender-m" /><Label htmlFor="t-gender-m" className="cursor-pointer">M</Label></div>
                                <div className="flex items-center gap-2"><RadioGroupItem value="F" id="t-gender-f" /><Label htmlFor="t-gender-f" className="cursor-pointer">F</Label></div>
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
                  </>
                )}

                {/* Step 1: Membership type */}
                {realStep === 1 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground mb-4">Seleziona la tipologia di tesseramento desiderata.</p>
                    <RadioGroup value={membershipType} onValueChange={setMembershipType} className="space-y-3">
                      {MEMBERSHIP_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          htmlFor={`mem-${opt.value}`}
                          className={`flex items-center justify-between border rounded-lg p-4 cursor-pointer transition-all ${membershipType === opt.value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={opt.value} id={`mem-${opt.value}`} />
                            <div>
                              <span className="text-sm font-medium">{opt.label}</span>
                              {opt.disciplines.length > 0 && (
                                <p className="text-xs text-muted-foreground">{opt.disciplines.join(" + ")}</p>
                              )}
                            </div>
                          </div>
                          <span className="font-display font-bold text-secondary">{formatPrice(opt.price)}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* Step 2: Photo */}
                {realStep === 2 && (
                  <div className="space-y-4">
                    {useExistingPhoto && !photoFile ? (
                      <>
                        <p className="text-sm text-muted-foreground">Abbiamo trovato la tua fototessera precedente. Vuoi mantenerla o aggiornala?</p>
                        <div className="flex items-center gap-4">
                          <img src={photoPreview!} alt="Foto attuale" className="w-24 h-24 object-cover rounded-lg border border-primary" />
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-sm text-primary">
                              <Check className="h-4 w-4" />
                              Foto attuale
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={() => { setUseExistingPhoto(false); setPhotoPreview(null); }}>
                              <Camera className="h-4 w-4 mr-1" />Aggiorna foto
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">Carica una fototessera o scatta un selfie.</p>
                        {useExistingPhoto && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setUseExistingPhoto(true); setPhotoFile(null); setPhotoPreview(returningUserData?.photo_thumb_url || returningUserData?.photo_url || null); }}>
                            ← Usa la foto precedente
                          </Button>
                        )}
                        <Input type="file" accept="image/*" capture="user" onChange={handlePhotoChange} className="cursor-pointer" />
                        {photoPreview && (
                          <div className="flex items-center gap-4">
                            <img src={photoPreview} alt="Anteprima foto" className="w-24 h-24 object-cover rounded-lg border border-border" />
                            <div className="flex items-center gap-1.5 text-sm text-primary">
                              <Check className="h-4 w-4" />
                              Foto caricata
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Step 3: Signature */}
                {realStep === 3 && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Firma con il dito o il mouse, oppure carica un'immagine della tua firma.</p>
                    <SignaturePad onSignatureChange={setSignatureData} value={signatureData} />
                    {signatureData && (
                      <div className="flex items-center gap-1.5 text-sm text-primary">
                        <Check className="h-4 w-4" />
                        Firma acquisita
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Medical certificates */}
                {realStep === 4 && !isSocioSostenitore && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Carica {requiredDisciplines.length > 1 ? "i certificati medici" : "il certificato medico"} per {requiredDisciplines.join(" e ")}.
                    </p>
                    {requiredDisciplines.map((discipline) => {
                      const cert = certificates.find((c) => c.discipline === discipline);
                      const kept = keptCertificates[discipline];
                      return (
                        <div key={discipline} className="border border-border rounded-lg p-4 space-y-3">
                          <Label className="text-sm font-medium capitalize">{discipline}</Label>

                          {/* Show existing valid certificate if available and no new upload */}
                          {kept && !cert && (
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm space-y-2">
                              <div className="flex items-center gap-1.5 text-primary">
                                <FileCheck className="h-4 w-4" />
                                Certificato già in archivio
                              </div>
                              {kept.expiry_date && (
                                <div><span className="text-muted-foreground">Scadenza: </span><span className="font-medium">{new Date(kept.expiry_date).toLocaleDateString("it-IT")}</span></div>
                              )}
                              {kept.disciplines && kept.disciplines.length > 0 && (
                                <div><span className="text-muted-foreground">Discipline: </span><span className="font-medium">{kept.disciplines.join(", ")}</span></div>
                              )}
                              {kept.ai_warning && (
                                <div className="flex items-start gap-1.5 text-yellow-600">
                                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                  <span>{kept.ai_warning}</span>
                                </div>
                              )}
                              <Button type="button" variant="outline" size="sm" onClick={() => {
                                setKeptCertificates((prev) => { const next = { ...prev }; delete next[discipline]; return next; });
                              }}>
                                <Upload className="h-4 w-4 mr-1" />Carica un nuovo certificato
                              </Button>
                            </div>
                          )}

                          {/* File upload (shown when no kept cert, or user chose to replace) */}
                          {!kept && (
                            <>
                              {existingCertificates.length > 0 && existingCertificates.some((c) => c.disciplines?.some((d) => d.toLowerCase() === discipline.toLowerCase())) && (
                                <Button type="button" variant="ghost" size="sm" onClick={() => {
                                  const match = existingCertificates.find((c) => c.disciplines?.some((d) => d.toLowerCase() === discipline.toLowerCase()));
                                  if (match) setKeptCertificates((prev) => ({ ...prev, [discipline]: match }));
                                  // Remove any new upload for this discipline
                                  setCertificates((prev) => prev.filter((c) => c.discipline !== discipline));
                                }}>
                                  ← Usa il certificato precedente
                                </Button>
                              )}
                              <Input type="file" accept="image/*,.pdf" onChange={handleCertificateUpload(discipline)} className="cursor-pointer" />
                            </>
                          )}

                          {cert?.analyzing && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />Analisi in corso...
                            </div>
                          )}
                          {cert?.analysis && !cert.analyzing && (
                            <div className={`rounded-lg p-3 text-sm space-y-1 ${cert.analysis.warning || cert.analysis.ai_warning ? "bg-yellow-500/10 border border-yellow-500/30" : "bg-primary/5 border border-primary/20"}`}>
                              {cert.analysis.expiry_date && (
                                <div><span className="text-muted-foreground">Scadenza: </span><span className="font-medium">{new Date(cert.analysis.expiry_date).toLocaleDateString("it-IT")}</span></div>
                              )}
                              {cert.analysis.disciplines?.length > 0 && (
                                <div><span className="text-muted-foreground">Discipline: </span><span className="font-medium">{cert.analysis.disciplines.join(", ")}</span></div>
                              )}
                              {(cert.analysis.warning || cert.analysis.ai_warning) && (
                                <div className="flex items-start gap-1.5 text-yellow-600">
                                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                  <span>{cert.analysis.warning || cert.analysis.ai_warning}</span>
                                </div>
                              )}
                              {!cert.analysis.warning && !cert.analysis.ai_warning && (
                                <div className="flex items-center gap-1.5 text-primary">
                                  <FileCheck className="h-4 w-4" />Certificato valido
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox id="skip-cert" checked={skipCertificate} onCheckedChange={(c) => setSkipCertificate(!!c)} />
                      <Label htmlFor="skip-cert" className="cursor-pointer text-sm text-muted-foreground">Carica il certificato in un secondo momento</Label>
                    </div>
                  </div>
                )}

                {/* Step 5: Payment */}
                {realStep === 5 && (
                  <div className="space-y-5">
                    {/* Summary */}
                    <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                      <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Riepilogo</h3>
                      <div className="text-sm space-y-1">
                        <div><span className="text-muted-foreground">Nome: </span><span className="font-medium">{watchedNome} {watchedCognome}</span></div>
                        <div><span className="text-muted-foreground">Tipologia: </span><span className="font-medium">{selectedOption?.label}</span></div>
                        <div><span className="text-muted-foreground">Totale: </span><span className="font-bold text-secondary">{selectedOption ? formatPrice(selectedOption.price) : ""}</span></div>
                        <div className="flex gap-3 pt-1">
                          {photoPreview && <span className="text-xs text-primary flex items-center gap-1"><Check className="h-3 w-3" />Foto</span>}
                          {signatureData && <span className="text-xs text-primary flex items-center gap-1"><Check className="h-3 w-3" />Firma</span>}
                          {certificates.length > 0 && <span className="text-xs text-primary flex items-center gap-1"><Check className="h-3 w-3" />{certificates.length} certificat{certificates.length > 1 ? "i" : "o"}</span>}
                          {skipCertificate && certificates.length === 0 && <span className="text-xs text-yellow-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Certificato non caricato</span>}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Metodo di pagamento *</Label>
                      <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem><FormControl>
                          <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {event.payment_methods.map((pm) => (
                              <label key={pm} htmlFor={`t-pay-${pm}`} className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition-all ${field.value === pm ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/40"}`}>
                                <RadioGroupItem value={pm} id={`t-pay-${pm}`} />
                                {PAYMENT_ICONS[pm]}
                                <span className="text-sm font-medium">{PAYMENT_LABELS[pm] || pm}</span>
                              </label>
                            ))}
                          </RadioGroup>
                        </FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <Button type="submit" size="lg" className="w-full font-display font-semibold text-lg h-12" disabled={isSubmitting}>
                      {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Elaborazione...</>) : `Tesserati e Paga — ${selectedOption ? formatPrice(selectedOption.price) : ""}`}
                    </Button>
                  </div>
                )}

                {/* Navigation buttons */}
                {realStep !== 5 && (
                  <div className="flex justify-between pt-2">
                    <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                      <ChevronLeft className="h-4 w-4 mr-1" />Indietro
                    </Button>
                    <Button type="button" onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))} disabled={!canProceed()}>
                      Avanti<ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
                {realStep === 5 && step > 0 && (
                  <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} className="w-full mt-2">
                    <ChevronLeft className="h-4 w-4 mr-1" />Torna indietro
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default TesseramentoForm;
