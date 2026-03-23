import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Loader2, UserCheck, Search, Smartphone, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { obfuscateEmail, obfuscatePhone, obfuscateCF } from "@/lib/registration-utils";
import type { CustomField } from "@/hooks/use-event";
import { getOptionPrice, getRouteSelectionField } from "@/lib/event-pricing";
import { formatPrice } from "@/hooks/use-event";

interface MatchedParticipant {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  codice_fiscale: string | null;
  birth_date: string | null;
  birth_place: string | null;
  identification_type: string;
  photo_thumb_url: string | null;
}

interface AdminAddRegistrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventCustomFields: CustomField[];
  password: string;
  onSuccess: () => void;
}

const AdminAddRegistration = ({ open, onOpenChange, eventId, eventCustomFields, password, onSuccess }: AdminAddRegistrationProps) => {
  const { toast } = useToast();

  // Step: "search" | "form" | "satispay_waiting"
  const [step, setStep] = useState<"search" | "form" | "satispay_waiting">("search");

  // Search state
  const [searchNome, setSearchNome] = useState("");
  const [searchCognome, setSearchCognome] = useState("");
  const [searchResults, setSearchResults] = useState<MatchedParticipant[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Selected existing participant
  const [selectedParticipant, setSelectedParticipant] = useState<MatchedParticipant | null>(null);

  // New participant fields
  const [fields, setFields] = useState<Record<string, any>>({
    nome: "", cognome: "", email: "", telefono: "",
    codice_fiscale: "", birth_date: "", birth_place: "",
    identification_type: "birth", newsletter: true,
  });

  // Custom field values
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("contanti");
  const [submitting, setSubmitting] = useState(false);

  // Satispay polling state
  const [satispayPaymentId, setSatispayPaymentId] = useState<string | null>(null);
  const [satispayRegistrationId, setSatispayRegistrationId] = useState<string | null>(null);
  const [satispayStatus, setSatispayStatus] = useState<"pending" | "paid" | "cancelled" | "error">("pending");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("search");
      setSearchNome("");
      setSearchCognome("");
      setSearchResults([]);
      setSearched(false);
      setSelectedParticipant(null);
      setFields({
        nome: "", cognome: "", email: "", telefono: "",
        codice_fiscale: "", birth_date: "", birth_place: "",
        identification_type: "birth", newsletter: true,
      });
      setCustomFieldValues({});
      setPaymentMethod("contanti");
      setSatispayPaymentId(null);
      setSatispayRegistrationId(null);
      setSatispayStatus("pending");
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [open]);

  // Satispay polling
  useEffect(() => {
    if (step !== "satispay_waiting" || !satispayPaymentId || !satispayRegistrationId) return;

    const checkPayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-satispay-payment", {
          body: { payment_id: satispayPaymentId, registration_id: satispayRegistrationId },
        });
        if (error) return;
        if (data.status === "completed") {
          setSatispayStatus("paid");
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            onOpenChange(false);
            onSuccess();
          }, 2000);
        } else if (data.status === "cancelled") {
          setSatispayStatus("cancelled");
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {}
    };

    checkPayment();
    intervalRef.current = setInterval(checkPayment, 3000);
    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setSatispayStatus("error");
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [step, satispayPaymentId, satispayRegistrationId]);

  const searchParticipants = async () => {
    if (!searchNome.trim() && !searchCognome.trim()) return;
    setSearching(true);
    try {
      let query = supabase
        .from("participants")
        .select("id, nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, identification_type, photo_thumb_url");
      
      if (searchNome.trim()) query = query.ilike("nome", `%${searchNome.trim()}%`);
      if (searchCognome.trim()) query = query.ilike("cognome", `%${searchCognome.trim()}%`);
      
      const { data } = await query.limit(20);
      setSearchResults(data || []);
      setSearched(true);
    } catch {
    } finally {
      setSearching(false);
    }
  };

  const selectExisting = (p: MatchedParticipant) => {
    setSelectedParticipant(p);
    setStep("form");
  };

  const createNew = () => {
    setSelectedParticipant(null);
    setFields(prev => ({
      ...prev,
      nome: searchNome,
      cognome: searchCognome,
    }));
    setStep("form");
  };

  const handleSubmit = async () => {
    // Validate custom fields
    for (const cf of eventCustomFields) {
      if (cf.required && !customFieldValues[cf.key]) {
        toast({ title: "Errore", description: `${cf.label} è obbligatorio`, variant: "destructive" });
        return;
      }
    }

    setSubmitting(true);
    try {
      let participantId = selectedParticipant?.id;

      // If no existing participant, create one
      if (!participantId) {
        if (!fields.nome || !fields.cognome || !fields.email || !fields.telefono) {
          toast({ title: "Errore", description: "Nome, cognome, email e telefono sono obbligatori", variant: "destructive" });
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("manage-event", {
          body: { password, action: "create_participant", participant: fields },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        participantId = data.participant.id;
      }

      // If Satispay, use the dedicated flow
      if (paymentMethod === "satispay") {
        const { data, error } = await supabase.functions.invoke("manage-event", {
          body: {
            password,
            action: "admin_satispay",
            participant_id: participantId,
            event_id: eventId,
            custom_data: customFieldValues,
          },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setSatispayPaymentId(data.payment_id);
        setSatispayRegistrationId(data.registration_id);
        setSatispayStatus("pending");
        setStep("satispay_waiting");
        setSubmitting(false);
        return;
      }

      // Regular registration (contanti, admin, etc.)
      const { data, error } = await supabase.functions.invoke("manage-event", {
        body: {
          password,
          action: "admin_register",
          participant_id: participantId,
          event_id: eventId,
          payment_method: paymentMethod,
          custom_data: customFieldValues,
        },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const name = selectedParticipant
        ? `${selectedParticipant.nome} ${selectedParticipant.cognome}`
        : `${fields.nome} ${fields.cognome}`;
      toast({ title: "Iscrizione creata", description: `${name} iscritto con successo.` });
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Aggiungi iscritto</DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Cerca un partecipante esistente o creane uno nuovo."
              : step === "satispay_waiting"
                ? "In attesa del pagamento Satispay..."
                : selectedParticipant
                  ? `Iscrivi ${selectedParticipant.nome} ${selectedParticipant.cognome} all'evento.`
                  : "Compila i dati del nuovo partecipante e iscrivilo all'evento."
            }
          </DialogDescription>
        </DialogHeader>

        {step === "search" && (
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Nome</Label>
                <Input
                  placeholder="Mario"
                  value={searchNome}
                  onChange={(e) => setSearchNome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchParticipants()}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Cognome</Label>
                <Input
                  placeholder="Rossi"
                  value={searchCognome}
                  onChange={(e) => setSearchCognome(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchParticipants()}
                />
              </div>
            </div>
            <Button onClick={searchParticipants} disabled={searching || (!searchNome.trim() && !searchCognome.trim())} className="w-full">
              {searching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Cerca
            </Button>

            {searched && (
              <div className="space-y-2">
                {searchResults.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {searchResults.length} risultat{searchResults.length === 1 ? "o" : "i"} trovati:
                    </p>
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectExisting(p)}
                        className="w-full text-left border border-border rounded-lg p-3 hover:border-primary hover:bg-primary/5 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          {p.photo_thumb_url && (
                            <img src={p.photo_thumb_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border shrink-0" />
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-sm font-medium">{p.nome} {p.cognome}</p>
                            <p className="text-xs text-muted-foreground">{obfuscateEmail(p.email)} · {obfuscatePhone(p.telefono)}</p>
                            {p.codice_fiscale && (
                              <p className="text-xs text-muted-foreground font-mono">{obfuscateCF(p.codice_fiscale)}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Nessun partecipante trovato.</p>
                )}
                <Button variant="outline" onClick={createNew} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Crea nuovo partecipante
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "form" && (
          <div className="space-y-4 mt-2">
            {selectedParticipant && (
              <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Partecipante esistente</span>
                </div>
                <p className="text-sm">{selectedParticipant.nome} {selectedParticipant.cognome}</p>
                <p className="text-xs text-muted-foreground">{selectedParticipant.email} · {selectedParticipant.telefono}</p>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { setStep("search"); setSelectedParticipant(null); }}>
                  Cambia
                </Button>
              </div>
            )}

            {!selectedParticipant && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Nome *</Label>
                    <Input value={fields.nome} onChange={(e) => setFields(prev => ({ ...prev, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Cognome *</Label>
                    <Input value={fields.cognome} onChange={(e) => setFields(prev => ({ ...prev, cognome: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Email *</Label>
                  <Input type="email" value={fields.email} onChange={(e) => setFields(prev => ({ ...prev, email: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Telefono *</Label>
                  <Input type="tel" value={fields.telefono} onChange={(e) => setFields(prev => ({ ...prev, telefono: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm">Data di nascita</Label>
                    <Input type="date" value={fields.birth_date} onChange={(e) => setFields(prev => ({ ...prev, birth_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Luogo di nascita</Label>
                    <Input value={fields.birth_place} onChange={(e) => setFields(prev => ({ ...prev, birth_place: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm">Codice Fiscale</Label>
                  <Input value={fields.codice_fiscale} onChange={(e) => setFields(prev => ({ ...prev, codice_fiscale: e.target.value.toUpperCase() }))} className="uppercase" />
                </div>
              </div>
            )}

            {eventCustomFields.length > 0 && (
              <div className="space-y-3 border-t border-border/50 pt-4">
                <Label className="text-sm font-medium">Informazioni aggiuntive</Label>
                {eventCustomFields.map((cf) => (
                  <AdminCustomFieldInput
                    key={cf.key}
                    field={cf}
                    value={customFieldValues[cf.key] || ""}
                    onChange={(v) => setCustomFieldValues(prev => ({ ...prev, [cf.key]: v }))}
                  />
                ))}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-sm">Metodo di pagamento</Label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="contanti">Contanti</option>
                <option value="admin">Admin (gratuito)</option>
                <option value="stripe">Stripe</option>
                <option value="satispay">Satispay</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { if (selectedParticipant) { setStep("search"); setSelectedParticipant(null); } else onOpenChange(false); }}>
                {selectedParticipant ? "Indietro" : "Annulla"}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                {paymentMethod === "satispay" ? "Invia richiesta Satispay" : "Iscrivi"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "satispay_waiting" && (
          <div className="py-8 text-center space-y-6">
            {satispayStatus === "pending" && (
              <>
                <div className="relative mx-auto w-20 h-20">
                  <Smartphone className="h-12 w-12 absolute inset-0 m-auto text-primary" />
                  <Loader2 className="h-20 w-20 absolute inset-0 animate-spin text-primary/30" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">In attesa del pagamento</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    La richiesta di pagamento è stata inviata. Attendere la conferma dall'app Satispay.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  onOpenChange(false);
                  onSuccess(); // Refresh to show the pending registration
                }}>
                  Chiudi (resta in attesa)
                </Button>
              </>
            )}
            {satispayStatus === "paid" && (
              <>
                <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">Pagamento ricevuto!</h3>
                  <p className="text-muted-foreground text-sm">Iscrizione completata con successo.</p>
                </div>
              </>
            )}
            {(satispayStatus === "cancelled" || satispayStatus === "error") && (
              <>
                <XCircle className="h-16 w-16 mx-auto text-destructive" />
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground mb-2">
                    {satispayStatus === "cancelled" ? "Pagamento annullato" : "Tempo scaduto"}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    L'iscrizione resta in sospeso. Puoi reinviare la richiesta dalla lista iscritti.
                  </p>
                </div>
                <Button variant="outline" onClick={() => {
                  onOpenChange(false);
                  onSuccess();
                }}>
                  Chiudi
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

function AdminCustomFieldInput({ field, value, onChange }: { field: CustomField; value: string; onChange: (v: string) => void }) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  if (field.type === "select" && field.options) {
    return (
      <div className="space-y-1">
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
      </div>
    );
  }
  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={`admin-${field.key}`} checked={value === "true"} onCheckedChange={(c) => onChange(c ? "true" : "false")} />
        <Label htmlFor={`admin-${field.key}`} className="cursor-pointer text-sm">{label}</Label>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      <Input type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder || ""} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default AdminAddRegistration;
