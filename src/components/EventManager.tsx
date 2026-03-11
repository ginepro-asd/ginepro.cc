import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { CustomField } from "@/hooks/use-event";
import { formatPrice } from "@/hooks/use-event";
import { getStartingPrice, hasVariablePricing } from "@/lib/event-pricing";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Loader2, Plus, Pencil, Trash2, MapPin, Calendar, Check, Eye, EyeOff,
} from "lucide-react";
import LocationPicker from "@/components/LocationPicker";

interface EventRecord {
  id: string;
  nome: string;
  slug: string;
  descrizione: string | null;
  data_evento: string | null;
  luogo: string | null;
  prezzo: number;
  scadenza_iscrizioni: string | null;
  attivo: boolean;
  hero_image: string | null;
  payment_methods: string[] | null;
  is_tesseramento: boolean;
  visibile_in_landing: boolean;
  is_coppia: boolean;
  pettorale_start: number | null;
  custom_fields: CustomField[] | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  external_url: string | null;
  created_at: string;
}

const normalizeCustomFields = (customFields: unknown): CustomField[] =>
  Array.isArray(customFields) ? (customFields as CustomField[]) : [];

const sanitizeCustomFields = (customFields: CustomField[]): CustomField[] =>
  customFields.map((field) => {
    if (field.type !== "select" || !field.options?.length) {
      return field;
    }

    const optionPrices = Object.fromEntries(
      field.options
        .map((option) => {
          const rawPrice = field.option_prices?.[option];
          const numericPrice =
            typeof rawPrice === "number"
              ? rawPrice
              : typeof rawPrice === "string" && rawPrice.trim()
                ? Number(rawPrice)
                : null;

          return Number.isFinite(numericPrice)
            ? [option, Math.round(Number(numericPrice))]
            : null;
        })
        .filter((entry): entry is [string, number] => entry !== null),
    );

    return {
      ...field,
      option_prices: Object.keys(optionPrices).length > 0 ? optionPrices : undefined,
    };
  });

interface EventManagerProps {
  password: string;
}

const EventManager = ({ password }: EventManagerProps) => {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRecord | null>(null);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleteEvent, setDeleteEvent] = useState<EventRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-event", {
        body: { password, action: "list" },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setEvents(data.events || []);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const openEditDialog = (ev: EventRecord | null) => {
    if (ev) {
      setCreating(false);
      setEditEvent(ev);
      setEditFields({
        nome: ev.nome,
        slug: ev.slug,
        descrizione: ev.descrizione || "",
        data_evento: ev.data_evento || "",
        luogo: ev.luogo || "",
        prezzo: ev.prezzo,
        scadenza_iscrizioni: ev.scadenza_iscrizioni ? ev.scadenza_iscrizioni.slice(0, 16) : "",
        attivo: ev.attivo,
        hero_image: ev.hero_image || "",
        is_tesseramento: ev.is_tesseramento,
        visibile_in_landing: ev.visibile_in_landing ?? true,
        is_coppia: ev.is_coppia,
        pettorale_start: ev.pettorale_start ?? "",
        location_lat: ev.location_lat,
        location_lng: ev.location_lng,
        location_label: ev.location_label || "",
        location_address: ev.luogo || "",
        custom_fields: normalizeCustomFields(ev.custom_fields),
        external_url: ev.external_url || "",
      });
    } else {
      setCreating(true);
      setEditEvent({ id: "" } as EventRecord);
      setEditFields({
        nome: "",
        slug: "",
        descrizione: "",
        data_evento: "",
        luogo: "",
        prezzo: 500,
        scadenza_iscrizioni: "",
        attivo: true,
        hero_image: "",
        is_tesseramento: false,
        visibile_in_landing: true,
        is_coppia: false,
        pettorale_start: "",
        location_lat: null,
        location_lng: null,
        location_label: "",
        location_address: "",
        custom_fields: [],
        external_url: "",
      });
    }
  };

  const autoSlug = (nome: string) => {
    return nome
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

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
        attivo: editFields.attivo,
        hero_image: editFields.hero_image || null,
        is_tesseramento: editFields.is_tesseramento,
        visibile_in_landing: editFields.visibile_in_landing ?? true,
        is_coppia: editFields.is_coppia,
        pettorale_start: editFields.pettorale_start ? parseInt(editFields.pettorale_start) : null,
        location_lat: editFields.location_lat || null,
        location_lng: editFields.location_lng || null,
        location_label: editFields.location_label || null,
        external_url: editFields.external_url || null,
        custom_fields: sanitizeCustomFields(normalizeCustomFields(editFields.custom_fields)),
      };

      const action = creating ? "create" : "update";
      const body: any = { password, action, fields };
      if (!creating) body.event_id = editEvent!.id;

      const { data, error } = await supabase.functions.invoke("manage-event", { body });
      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast({ title: creating ? "Evento creato" : "Evento aggiornato" });
      setEditEvent(null);
      fetchEvents();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteEvent) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-event", {
        body: { password, action: "delete", event_id: deleteEvent.id },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast({ title: "Evento eliminato" });
      setDeleteEvent(null);
      fetchEvents();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading && events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">Gestione Eventi</h2>
        <Button onClick={() => openEditDialog(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuovo evento
        </Button>
      </div>

      <div className="grid gap-3">
        {events.map((ev) => (
          <Card key={ev.id} className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display font-bold text-foreground truncate">{ev.nome}</span>
                  <Badge variant={ev.attivo ? "default" : "secondary"} className="shrink-0">
                    {ev.attivo ? "Attivo" : "Inattivo"}
                  </Badge>
                  {ev.is_coppia && <Badge variant="outline" className="shrink-0">Coppia</Badge>}
                  {ev.is_tesseramento && <Badge variant="outline" className="shrink-0">Tesseramento</Badge>}
                  <Badge variant="outline" className="shrink-0 gap-1">
                    {ev.visibile_in_landing ? (
                      <>
                        <Eye className="h-3 w-3" />
                        Landing visibile
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" />
                        Landing nascosta
                      </>
                    )}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>/{ev.slug}</span>
                  {ev.data_evento && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(ev.data_evento).toLocaleDateString("it-IT")}
                    </span>
                  )}
                  {ev.location_label && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ev.location_label}
                    </span>
                  )}
                  <span>
                    {hasVariablePricing(normalizeCustomFields(ev.custom_fields))
                      ? `da ${formatPrice(getStartingPrice(ev.prezzo, normalizeCustomFields(ev.custom_fields)))}`
                      : formatPrice(ev.prezzo)}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => openEditDialog(ev)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setDeleteEvent(ev)}
                  className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editEvent} onOpenChange={(open) => { if (!open) setEditEvent(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {creating ? "Nuovo evento" : "Modifica evento"}
            </DialogTitle>
            <DialogDescription>
              {creating ? "Crea un nuovo evento" : `Modifica ${editFields.nome}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Basic info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Nome *</Label>
                <Input value={editFields.nome || ""} onChange={(e) => {
                  const nome = e.target.value;
                  setEditFields(prev => ({
                    ...prev,
                    nome,
                    ...(creating && !prev._slugEdited ? { slug: autoSlug(nome) } : {}),
                  }));
                }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Slug *</Label>
                <Input value={editFields.slug || ""} onChange={(e) =>
                  setEditFields(prev => ({ ...prev, slug: e.target.value, _slugEdited: true }))
                } />
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
              <Label className="text-sm">Immagine hero (URL)</Label>
              <Input value={editFields.hero_image || ""} placeholder="/images/..."
                onChange={(e) => setEditFields(prev => ({ ...prev, hero_image: e.target.value }))} />
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={editFields.attivo ?? true}
                  onCheckedChange={(v) => setEditFields(prev => ({ ...prev, attivo: v }))} />
                <Label className="text-sm">Attivo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editFields.is_coppia ?? false}
                  onCheckedChange={(v) => setEditFields(prev => ({ ...prev, is_coppia: v }))} />
                <Label className="text-sm">Coppia</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editFields.is_tesseramento ?? false}
                  onCheckedChange={(v) => setEditFields(prev => ({ ...prev, is_tesseramento: v }))} />
                <Label className="text-sm">Tesseramento</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editFields.visibile_in_landing ?? true}
                  onCheckedChange={(v) => setEditFields(prev => ({ ...prev, visibile_in_landing: v }))} />
                <Label className="text-sm">Visibile nella landing</Label>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Se disattivato, l&apos;evento sparisce dalla landing ma resta raggiungibile con link diretto e disponibile in area admin.
            </p>

            {editFields.is_coppia && (
              <div className="space-y-1.5">
                <Label className="text-sm">Pettorale di partenza</Label>
                <Input type="number" value={editFields.pettorale_start ?? ""}
                  onChange={(e) => setEditFields(prev => ({ ...prev, pettorale_start: e.target.value }))} />
              </div>
            )}

            {/* Location with map */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-primary" />
                Posizione evento
              </Label>
              <LocationPicker
                lat={editFields.location_lat}
                lng={editFields.location_lng}
                address={editFields.location_address || ""}
                label={editFields.location_label || ""}
                onChangeLocation={(lat, lng, address) =>
                  setEditFields(prev => ({ ...prev, location_lat: lat, location_lng: lng, location_address: address, luogo: address }))
                }
                onChangeLabel={(label) =>
                  setEditFields(prev => ({ ...prev, location_label: label }))
                }
              />
            </div>

            {normalizeCustomFields(editFields.custom_fields).some(
              (field) => field.type === "select" && field.options && field.options.length > 0,
            ) && (
              <div className="space-y-3 border-t border-border/50 pt-5">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Prezzi percorsi / opzioni</Label>
                  <p className="text-xs text-muted-foreground">
                    Lascia vuoto un prezzo per continuare a usare il prezzo base dell&apos;evento.
                  </p>
                </div>

                <div className="space-y-3">
                  {normalizeCustomFields(editFields.custom_fields)
                    .filter((field) => field.type === "select" && field.options && field.options.length > 0)
                    .map((field) => (
                      <Card key={field.key} className="border-border/50 bg-muted/20">
                        <CardContent className="pt-5 space-y-3">
                          <div>
                            <p className="font-medium text-sm text-foreground">{field.label}</p>
                            <p className="text-xs text-muted-foreground">
                              Prezzo base attuale: {formatPrice(parseInt(editFields.prezzo) || 0)}
                            </p>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {field.options?.map((option) => (
                              <div key={option} className="space-y-1.5">
                                <Label className="text-sm">{option}</Label>
                                <Input
                                  type="number"
                                  placeholder={`${editFields.prezzo ?? 0}`}
                                  value={field.option_prices?.[option] ?? ""}
                                  onChange={(e) =>
                                    setEditFields((prev) => ({
                                      ...prev,
                                      custom_fields: normalizeCustomFields(prev.custom_fields).map((customField) =>
                                        customField.key !== field.key
                                          ? customField
                                          : {
                                              ...customField,
                                              option_prices: {
                                                ...(customField.option_prices || {}),
                                                [option]: e.target.value,
                                              },
                                            },
                                      ),
                                    }))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditEvent(null)}>Annulla</Button>
            <Button onClick={saveEvent} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              {creating ? "Crea evento" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteEvent} onOpenChange={(open) => { if (!open) setDeleteEvent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina evento</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare "{deleteEvent?.nome}"? L'evento può essere eliminato solo se non ha iscrizioni collegate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventManager;
