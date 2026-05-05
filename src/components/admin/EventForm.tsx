import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { CustomField } from "@/hooks/use-event";
import { formatPrice } from "@/hooks/use-event";
import { Loader2, Check, Upload, Image, FileText, Link as LinkIcon, MapPin, Smartphone } from "lucide-react";
import LocationPicker from "@/components/LocationPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const normalizeCustomFields = (cf: unknown): CustomField[] =>
  Array.isArray(cf) ? (cf as CustomField[]) : [];

const sanitizeCustomFields = (customFields: CustomField[]): CustomField[] =>
  customFields.map((field) => {
    if (field.type !== "select" || !field.options?.length) return field;
    const optionPrices = Object.fromEntries(
      field.options.map((option) => {
        const rawPrice = field.option_prices?.[option];
        const numericPrice =
          typeof rawPrice === "number" ? rawPrice
          : typeof rawPrice === "string" && rawPrice.trim() ? Number(rawPrice)
          : null;
        return Number.isFinite(numericPrice)
          ? [option, Math.round(Number(numericPrice))]
          : null;
      }).filter((e): e is [string, number] => e !== null),
    );
    const maxSpots = field.option_max_spots
      ? Object.fromEntries(Object.entries(field.option_max_spots).filter(([, v]) => typeof v === "number" && v > 0))
      : undefined;
    const reqCert = field.option_requires_certificate
      ? Object.fromEntries(Object.entries(field.option_requires_certificate).filter(([, v]) => v === true))
      : undefined;
    const featured = field.option_featured
      ? Object.fromEntries(Object.entries(field.option_featured).filter(([, v]) => v === true))
      : undefined;
    return {
      ...field,
      option_prices: Object.keys(optionPrices).length > 0 ? optionPrices : undefined,
      option_max_spots: maxSpots && Object.keys(maxSpots).length > 0 ? maxSpots : undefined,
      option_requires_certificate: reqCert && Object.keys(reqCert).length > 0 ? reqCert : undefined,
      option_featured: featured && Object.keys(featured).length > 0 ? featured : undefined,
    };
  });

interface EventFormProps {
  password: string;
  event?: any | null;
  creating?: boolean;
}

const EventForm = ({ password, event, creating = false }: EventFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [regUploading, setRegUploading] = useState(false);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const regInputRef = useRef<HTMLInputElement>(null);

  const initialFields = event
    ? {
        nome: event.nome,
        slug: event.slug,
        descrizione: event.descrizione || "",
        data_evento: event.data_evento || "",
        luogo: event.luogo || "",
        prezzo: event.prezzo,
        scadenza_iscrizioni: event.scadenza_iscrizioni ? event.scadenza_iscrizioni.slice(0, 16) : "",
        chiusura_ore_prima: event.chiusura_ore_prima ?? 24,
        attivo: event.attivo,
        hero_image: event.hero_image || "",
        payment_methods: event.payment_methods || ["stripe", "satispay", "paypal"],
        is_tesseramento: event.is_tesseramento,
        visibile_in_landing: event.visibile_in_landing ?? true,
        is_coppia: event.is_coppia,
        pettorale_start: event.pettorale_start ?? "",
        location_lat: event.location_lat,
        location_lng: event.location_lng,
        location_label: event.location_label || "",
        location_address: event.luogo || "",
        custom_fields: normalizeCustomFields(event.custom_fields),
        external_url: event.external_url || "",
        regulation_url: event.regulation_url || "",
        satispay_account_id: event.satispay_account_id || "",
        richiedi_societa: event.richiedi_societa ?? false,
      }
    : {
        nome: "", slug: "", descrizione: "", data_evento: "", luogo: "",
        prezzo: 500, scadenza_iscrizioni: "", chiusura_ore_prima: 24,
        attivo: true, hero_image: "", payment_methods: ["stripe", "satispay", "paypal"],
        is_tesseramento: false, visibile_in_landing: true, is_coppia: false,
        pettorale_start: "", location_lat: null, location_lng: null,
        location_label: "", location_address: "", custom_fields: [],
        external_url: "", regulation_url: "", satispay_account_id: "",
        richiedi_societa: false,
      };

  const [editFields, setEditFields] = useState<Record<string, any>>(initialFields);
  const [satispayAccounts, setSatispayAccounts] = useState<Array<{ id: string; nome: string; is_default: boolean }>>([]);

  useEffect(() => {
    if (!password) return;
    supabase.functions.invoke("manage-event", {
      body: { password, action: "list_satispay_accounts" },
    }).then(({ data }) => {
      if (data?.accounts) setSatispayAccounts(data.accounts);
    });
  }, [password]);

  const autoSlug = (nome: string) =>
    nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const saveEvent = async () => {
    if (!editFields.nome || !editFields.slug) {
      toast({ title: "Errore", description: "Nome e slug sono obbligatori", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const fields: Record<string, any> = {
        nome: editFields.nome,
        slug: editFields.slug,
        descrizione: editFields.descrizione || null,
        data_evento: editFields.data_evento || null,
        luogo: editFields.location_address || editFields.luogo || null,
        prezzo: parseInt(editFields.prezzo) || 0,
        scadenza_iscrizioni: editFields.scadenza_iscrizioni ? new Date(editFields.scadenza_iscrizioni).toISOString() : null,
        chiusura_ore_prima: editFields.chiusura_ore_prima !== "" && editFields.chiusura_ore_prima != null ? parseInt(editFields.chiusura_ore_prima) : 24,
        attivo: editFields.attivo,
        hero_image: editFields.hero_image || null,
        payment_methods: editFields.payment_methods || ["stripe", "satispay", "paypal"],
        is_tesseramento: editFields.is_tesseramento,
        visibile_in_landing: editFields.visibile_in_landing ?? true,
        is_coppia: editFields.is_coppia,
        pettorale_start: editFields.pettorale_start ? parseInt(editFields.pettorale_start) : null,
        location_lat: editFields.location_lat || null,
        location_lng: editFields.location_lng || null,
        location_label: editFields.location_label || null,
        external_url: editFields.external_url || null,
        regulation_url: editFields.regulation_url || null,
        satispay_account_id: editFields.satispay_account_id || null,
        richiedi_societa: !!editFields.richiedi_societa,
        custom_fields: sanitizeCustomFields(normalizeCustomFields(editFields.custom_fields)),
      };
      const action = creating ? "create" : "update";
      const body: any = { password, action, fields };
      if (!creating) body.event_id = event.id;
      const { data, error } = await supabase.functions.invoke("manage-event", { body });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast({ title: creating ? "Evento creato" : "Evento aggiornato" });
      navigate("/admin/events");
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Nome *</Label>
          <Input value={editFields.nome || ""} onChange={(e) => {
            const nome = e.target.value;
            setEditFields(prev => ({
              ...prev, nome,
              ...(creating && !prev._slugEdited ? { slug: autoSlug(nome) } : {}),
            }));
          }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Slug *</Label>
          <Input value={editFields.slug || ""} onChange={(e) =>
            setEditFields(prev => ({ ...prev, slug: e.target.value, _slugEdited: true }))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Descrizione</Label>
        <Textarea value={editFields.descrizione || ""} rows={3}
          onChange={(e) => setEditFields(prev => ({ ...prev, descrizione: e.target.value }))} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Data evento</Label>
          <Input type="date" value={editFields.data_evento || ""}
            onChange={(e) => setEditFields(prev => ({ ...prev, data_evento: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Prezzo (centesimi)</Label>
          <Input type="number" value={editFields.prezzo ?? 0}
            onChange={(e) => setEditFields(prev => ({ ...prev, prezzo: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Scadenza iscrizioni</Label>
          <Input type="datetime-local" value={editFields.scadenza_iscrizioni || ""}
            onChange={(e) => setEditFields(prev => ({ ...prev, scadenza_iscrizioni: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Chiusura iscrizioni online (ore prima dell'evento)</Label>
        <Input type="number" min={0} value={editFields.chiusura_ore_prima ?? 24}
          onChange={(e) => setEditFields(prev => ({ ...prev, chiusura_ore_prima: e.target.value }))} />
        <p className="text-xs text-muted-foreground">Default: 24.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Image className="h-4 w-4 text-primary" /> Immagine hero
        </Label>
        {editFields.hero_image && (
          <div className="relative rounded-lg overflow-hidden border border-border/50 max-h-32">
            <img src={editFields.hero_image} alt="Hero" className="w-full h-32 object-cover" />
            <Button size="sm" variant="destructive" className="absolute top-2 right-2 h-7 text-xs"
              onClick={() => setEditFields(prev => ({ ...prev, hero_image: "" }))}>Rimuovi</Button>
          </div>
        )}
        <div className="flex gap-2">
          <input ref={heroInputRef} type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setHeroUploading(true);
              try {
                const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
                const { error } = await supabase.storage.from("heroes").upload(path, file);
                if (error) throw error;
                const { data } = supabase.storage.from("heroes").getPublicUrl(path);
                setEditFields(prev => ({ ...prev, hero_image: data.publicUrl }));
                toast({ title: "Immagine caricata" });
              } catch (err: any) {
                toast({ title: "Errore upload", description: err.message, variant: "destructive" });
              } finally { setHeroUploading(false); }
            }} />
          <Button type="button" variant="outline" size="sm" disabled={heroUploading}
            onClick={() => heroInputRef.current?.click()}>
            {heroUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Carica
          </Button>
          <Input value={editFields.hero_image || ""} placeholder="URL immagine..."
            className="flex-1 h-9 text-sm"
            onChange={(e) => setEditFields(prev => ({ ...prev, hero_image: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-primary" /> Regolamento
        </Label>
        {editFields.regulation_url && (
          <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <a href={editFields.regulation_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary hover:underline truncate flex-1">{editFields.regulation_url}</a>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive"
              onClick={() => setEditFields(prev => ({ ...prev, regulation_url: "" }))}>Rimuovi</Button>
          </div>
        )}
        <div className="flex gap-2">
          <input ref={regInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setRegUploading(true);
              try {
                const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "")}`;
                const { error } = await supabase.storage.from("regulations").upload(path, file);
                if (error) throw error;
                const { data } = supabase.storage.from("regulations").getPublicUrl(path);
                setEditFields(prev => ({ ...prev, regulation_url: data.publicUrl }));
                toast({ title: "Regolamento caricato" });
              } catch (err: any) {
                toast({ title: "Errore upload", description: err.message, variant: "destructive" });
              } finally { setRegUploading(false); }
            }} />
          <Button type="button" variant="outline" size="sm" disabled={regUploading}
            onClick={() => regInputRef.current?.click()}>
            {regUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Carica PDF
          </Button>
          <Input value={editFields.regulation_url || ""} placeholder="https://..."
            className="flex-1 h-9 text-sm"
            onChange={(e) => setEditFields(prev => ({ ...prev, regulation_url: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">URL iscrizione esterna</Label>
        <Input value={editFields.external_url || ""} placeholder="https://..."
          onChange={(e) => setEditFields(prev => ({ ...prev, external_url: e.target.value }))} />
      </div>

      <div className="flex flex-wrap gap-6">
        {[
          { key: "attivo", label: "Attivo" },
          { key: "is_coppia", label: "Coppia" },
          { key: "is_tesseramento", label: "Tesseramento" },
          { key: "visibile_in_landing", label: "Visibile nella landing" },
          { key: "richiedi_societa", label: "Richiedi società" },
        ].map((t) => (
          <div key={t.key} className="flex items-center gap-2">
            <Switch checked={editFields[t.key] ?? false}
              onCheckedChange={(v) => setEditFields(prev => ({ ...prev, [t.key]: v }))} />
            <Label className="text-sm">{t.label}</Label>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Metodi di pagamento</Label>
        <div className="flex flex-wrap gap-3">
          {[
            { value: "stripe", label: "Stripe" },
            { value: "satispay", label: "Satispay" },
            { value: "paypal", label: "PayPal" },
            { value: "contanti", label: "Contanti" },
          ].map((method) => {
            const methods = editFields.payment_methods || [];
            const checked = methods.includes(method.value);
            return (
              <label key={method.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={checked}
                  onChange={() => {
                    const next = checked
                      ? methods.filter((m: string) => m !== method.value)
                      : [...methods, method.value];
                    setEditFields((prev: any) => ({ ...prev, payment_methods: next }));
                  }}
                  className="rounded border-input" />
                {method.label}
              </label>
            );
          })}
        </div>
      </div>

      {(editFields.payment_methods || []).includes("satispay") && (
        <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-muted/10">
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Smartphone className="h-4 w-4 text-primary" /> Account Satispay
          </Label>
          <Select
            value={editFields.satispay_account_id || "__default__"}
            onValueChange={(v) => setEditFields(prev => ({ ...prev, satispay_account_id: v === "__default__" ? "" : v }))}
          >
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                Account predefinito{satispayAccounts.find(a => a.is_default) ? ` (${satispayAccounts.find(a => a.is_default)!.nome})` : ""}
              </SelectItem>
              {satispayAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}{a.is_default ? " ★" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Gestisci gli account da <a href="/admin/satispay" className="text-primary hover:underline">Satispay</a>.
          </p>
        </div>
      )}

      {editFields.is_coppia && (
        <div className="space-y-1.5">
          <Label className="text-sm">Pettorale di partenza</Label>
          <Input type="number" value={editFields.pettorale_start ?? ""}
            onChange={(e) => setEditFields(prev => ({ ...prev, pettorale_start: e.target.value }))} />
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <MapPin className="h-4 w-4 text-primary" /> Posizione evento
        </Label>
        <LocationPicker
          lat={editFields.location_lat} lng={editFields.location_lng}
          address={editFields.location_address || ""} label={editFields.location_label || ""}
          onChangeLocation={(lat, lng, address) =>
            setEditFields(prev => ({ ...prev, location_lat: lat, location_lng: lng, location_address: address, luogo: address }))}
          onChangeLabel={(label) => setEditFields(prev => ({ ...prev, location_label: label }))} />
      </div>

      {normalizeCustomFields(editFields.custom_fields).some(
        (f) => f.type === "select" && f.options && f.options.length > 0,
      ) && (
        <div className="space-y-3 border-t border-border/50 pt-5">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Prezzi percorsi / opzioni</Label>
            <p className="text-xs text-muted-foreground">Lascia vuoto un prezzo per usare quello base.</p>
          </div>
          <div className="space-y-3">
            {normalizeCustomFields(editFields.custom_fields)
              .filter((f) => f.type === "select" && f.options && f.options.length > 0)
              .map((field) => (
                <Card key={field.key} className="border-border/50 bg-muted/20">
                  <CardContent className="pt-5 space-y-3">
                    <div>
                      <p className="font-medium text-sm text-foreground">{field.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Prezzo base: {formatPrice(parseInt(editFields.prezzo) || 0)}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {field.options?.map((option) => (
                        <div key={option} className="space-y-1.5">
                          <Label className="text-sm">{option}</Label>
                          <Input type="number" placeholder={`${editFields.prezzo ?? 0}`}
                            value={field.option_prices?.[option] ?? ""}
                            onChange={(e) =>
                              setEditFields((prev) => ({
                                ...prev,
                                custom_fields: normalizeCustomFields(prev.custom_fields).map((cf) =>
                                  cf.key !== field.key ? cf : {
                                    ...cf,
                                    option_prices: { ...(cf.option_prices || {}), [option]: e.target.value },
                                  }),
                              }))} />
                          <div className="flex items-center gap-2 mt-1">
                            <Switch checked={field.option_coppia?.[option] ?? false}
                              onCheckedChange={(v) =>
                                setEditFields((prev) => ({
                                  ...prev,
                                  custom_fields: normalizeCustomFields(prev.custom_fields).map((cf) =>
                                    cf.key !== field.key ? cf : {
                                      ...cf,
                                      option_coppia: { ...(cf.option_coppia || {}), [option]: v },
                                    }),
                                }))} />
                            <Label className="text-xs text-muted-foreground">Iscrizione in coppia</Label>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Label className="text-xs text-muted-foreground w-20">Max posti</Label>
                            <Input type="number" placeholder="∞" className="h-7 text-xs w-20"
                              value={field.option_max_spots?.[option] ?? ""}
                              onChange={(e) =>
                                setEditFields((prev) => ({
                                  ...prev,
                                  custom_fields: normalizeCustomFields(prev.custom_fields).map((cf) =>
                                    cf.key !== field.key ? cf : {
                                      ...cf,
                                      option_max_spots: {
                                        ...(cf.option_max_spots || {}),
                                        [option]: e.target.value ? parseInt(e.target.value) : undefined,
                                      },
                                    }),
                                }))} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={field.option_requires_certificate?.[option] ?? false}
                              onCheckedChange={(v) =>
                                setEditFields((prev) => ({
                                  ...prev,
                                  custom_fields: normalizeCustomFields(prev.custom_fields).map((cf) =>
                                    cf.key !== field.key ? cf : {
                                      ...cf,
                                      option_requires_certificate: { ...(cf.option_requires_certificate || {}), [option]: v },
                                    }),
                                }))} />
                            <Label className="text-xs text-muted-foreground">Richiede certificato</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch checked={field.option_featured?.[option] ?? false}
                              onCheckedChange={(v) =>
                                setEditFields((prev) => ({
                                  ...prev,
                                  custom_fields: normalizeCustomFields(prev.custom_fields).map((cf) =>
                                    cf.key !== field.key ? cf : {
                                      ...cf,
                                      option_featured: { ...(cf.option_featured || {}), [option]: v },
                                    }),
                                }))} />
                            <Label className="text-xs text-muted-foreground">⭐ In evidenza</Label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
        <Button variant="outline" onClick={() => navigate("/admin/events")}>Annulla</Button>
        <Button onClick={saveEvent} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          {creating ? "Crea evento" : "Salva"}
        </Button>
      </div>
    </div>
  );
};

export default EventForm;
