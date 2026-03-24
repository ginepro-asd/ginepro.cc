import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Eye, Plus, Pencil, Trash2, Loader2, Check, X, ChevronDown, ChevronUp, Info, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EventEmail {
  id: string;
  event_id: string;
  slug: string;
  subject: string;
  body_html: string | null;
  trigger_type: string;
  orario_map: Record<string, string> | null;
  sent_at: string | null;
  created_at: string;
}

interface EventEmailSend {
  id: string;
  event_email_id: string;
  registration_id: string;
  status: string;
  error: string | null;
  sent_at: string;
}

interface Props {
  password: string;
}

const DEFAULT_CONFIRMATION_HTML = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a3a3a,#2d5a5a);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">{evento}</h1>
            <p style="margin:8px 0 0;color:#f0a090;font-size:14px;font-weight:600;">by GINEPRO</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#1a3a3a;font-size:20px;">Iscrizione confermata! ✅</h2>
            <p style="margin:0 0 24px;color:#666;font-size:15px;line-height:1.6;">
              Ciao <strong>{nome}</strong>, la tua iscrizione a <strong>{evento}</strong> è stata completata con successo.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafa;border-radius:8px;border:1px solid #e8eeee;">
              <tr><td style="padding:20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#888;font-size:13px;width:140px;">Nome</td>
                    <td style="padding:6px 0;color:#1a3a3a;font-size:14px;font-weight:600;">{nome} {cognome}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#888;font-size:13px;">Email</td>
                    <td style="padding:6px 0;color:#1a3a3a;font-size:14px;">{email}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
            <p style="margin:24px 0 0;color:#666;font-size:14px;line-height:1.6;">
              Conserva questa email come ricevuta della tua iscrizione. Ti contatteremo con ulteriori dettagli sull'evento.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;background-color:#f8fafa;border-top:1px solid #e8eeee;text-align:center;">
            <p style="margin:0;color:#999;font-size:12px;">© 2026 GINEPRO ASD</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export default function TransactionalEmailManager({ password }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [templates, setTemplates] = useState<EventEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTemplate, setEditTemplate] = useState<EventEmail | null>(null);
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<EventEmail | null>(null);
  const [bulkCount, setBulkCount] = useState<{ total: number; pending: number }>({ total: 0, pending: 0 });
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [showTestDialog, setShowTestDialog] = useState<EventEmail | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<EventEmailSend[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [orarioEntries, setOrarioEntries] = useState<[string, string][]>([]);
  const { toast } = useToast();

  useEffect(() => {
    supabase.from("events").select("id, nome, slug").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setEvents(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedEventId) { setTemplates([]); return; }
    loadTemplates();
  }, [selectedEventId]);

  const loadTemplates = async () => {
    if (!selectedEventId) return;
    setLoading(true);
    const { data } = await supabase
      .from("event_emails")
      .select("*")
      .eq("event_id", selectedEventId)
      .order("created_at");
    setTemplates((data as any[]) || []);
    setLoading(false);
  };

  const openEdit = (t: EventEmail) => {
    setEditTemplate(t);
    setEditFields({
      slug: t.slug,
      subject: t.subject,
      body_html: t.body_html || "",
      trigger_type: t.trigger_type,
    });
    setOrarioEntries(Object.entries(t.orario_map || {}));
    setShowNew(false);
  };

  const openNew = () => {
    setEditTemplate(null);
    setEditFields({ slug: "", subject: "", body_html: "", trigger_type: "manual" });
    setOrarioEntries([["", ""]]);
    setShowNew(true);
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      const orarioMap: Record<string, string> = {};
      for (const [k, v] of orarioEntries) {
        if (k.trim()) orarioMap[k.trim()] = v.trim();
      }

      const payload = {
        event_id: selectedEventId,
        slug: editFields.slug,
        subject: editFields.subject,
        body_html: editFields.body_html,
        trigger_type: editFields.trigger_type,
        orario_map: orarioMap,
      };

      if (editTemplate) {
        // Use edge function for update (service_role needed)
        const { data, error } = await supabase.functions.invoke("manage-event", {
          body: { password, action: "update_event_email", event_email_id: editTemplate.id, ...payload },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } else {
        const { data, error } = await supabase.functions.invoke("manage-event", {
          body: { password, action: "create_event_email", ...payload },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }

      toast({ title: "Salvato" });
      setEditTemplate(null);
      setShowNew(false);
      loadTemplates();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("manage-event", {
        body: { password, action: "delete_event_email", event_email_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Eliminato" });
      loadTemplates();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const prepareBulk = async (t: EventEmail) => {
    // Count total completed registrations and already sent
    const { count: total } = await supabase
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", t.event_id)
      .eq("payment_status", "completed");

    const { count: sent } = await supabase
      .from("event_email_sends")
      .select("id", { count: "exact", head: true })
      .eq("event_email_id", t.id)
      .eq("status", "sent");

    setBulkCount({ total: total || 0, pending: (total || 0) - (sent || 0) });
    setConfirmBulk(t);
  };

  const executeBulk = async () => {
    if (!confirmBulk) return;
    setSending(true);
    setSendProgress(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-email", {
        body: {
          event_email_id: confirmBulk.id,
          event_id: confirmBulk.event_id,
          mode: "bulk",
          password,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSendProgress({ sent: data.sent || 0, failed: data.failed || 0, total: data.total || 0 });
      toast({
        title: "Invio completato",
        description: `${data.sent} inviate, ${data.failed} errori su ${data.total} totali`,
      });
      loadTemplates();
    } catch (err: any) {
      toast({ title: "Errore invio", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendTestEmail = async () => {
    if (!showTestDialog || !testEmail) return;
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-event-email", {
        body: {
          event_email_id: showTestDialog.id,
          mode: "test",
          password,
          test_email: testEmail,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email di test inviata", description: `Inviata a ${testEmail}` });
      setShowTestDialog(null);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  const toggleLog = async (templateId: string) => {
    if (expandedLog === templateId) {
      setExpandedLog(null);
      return;
    }
    setExpandedLog(templateId);
    setLoadingLog(true);
    const { data } = await supabase
      .from("event_email_sends")
      .select("*")
      .eq("event_email_id", templateId)
      .order("sent_at", { ascending: false })
      .limit(100);
    setLogEntries((data as any[]) || []);
    setLoadingLog(false);
  };

  const showPreview = (html: string) => {
    // Simple preview with sample data
    const preview = html
      .replace(/{nome}/g, "Mario")
      .replace(/{cognome}/g, "Rossi")
      .replace(/{orario}/g, "9:00")
      .replace(/{email}/g, "mario@esempio.it")
      .replace(/{disciplina}/g, "Short 18Km")
      .replace(/{telefono}/g, "+39 333 1234567");
    setPreviewHtml(preview);
  };

  const isEditing = editTemplate || showNew;

  return (
    <div className="space-y-6">
      {/* Event selector */}
      <div className="flex items-center gap-4">
        <Label className="text-sm font-medium whitespace-nowrap">Evento:</Label>
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Seleziona evento" />
          </SelectTrigger>
          <SelectContent>
            {events.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedEventId && !isEditing && (
        <>
          {/* Fallback indicator for on_payment email */}
          {!loading && (() => {
            const hasOnPayment = templates.some(t => t.trigger_type === "on_payment");
            if (!hasOnPayment) {
              return (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <Info className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="flex items-center justify-between gap-3">
                    <span className="text-sm text-amber-800 dark:text-amber-200">
                      Nessuna email di conferma configurata. Viene utilizzato il <strong>template di sistema predefinito</strong>.
                    </span>
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => {
                      setEditTemplate(null);
                      setEditFields({
                        slug: "conferma-iscrizione",
                        subject: "Iscrizione confermata — {evento}",
                        trigger_type: "on_payment",
                        body_html: DEFAULT_CONFIRMATION_HTML,
                      });
                      setOrarioEntries([]);
                      setShowNew(true);
                    }}>
                      <Plus className="h-3 w-3 mr-1" /> Crea template conferma
                    </Button>
                  </AlertDescription>
                </Alert>
              );
            }
            return (
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Email di conferma configurata
              </div>
            );
          })()}

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-foreground">Email template</h3>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Nuovo template
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nessun template email per questo evento.</p>
          ) : (
            <div className="space-y-3">
              {templates.map(t => (
                <Card key={t.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{t.slug}</span>
                          <Badge variant={t.trigger_type === "on_payment" ? "default" : "secondary"} className="text-xs">
                            {t.trigger_type === "on_payment" ? "Automatica" : "Manuale"}
                          </Badge>
                          {t.sent_at && (
                            <Badge variant="outline" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Inviata
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{t.subject}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {t.body_html && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => showPreview(t.body_html!)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(t)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {t.trigger_type === "manual" && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowTestDialog(t)}>
                              Test
                            </Button>
                            <Button size="sm" className="h-8 text-xs" onClick={() => prepareBulk(t)}>
                              <Send className="h-3 w-3 mr-1" /> Invia a tutti
                            </Button>
                          </>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteTemplate(t.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Log toggle */}
                    <button
                      onClick={() => toggleLog(t.id)}
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {expandedLog === t.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      Log invii
                    </button>

                    {expandedLog === t.id && (
                      <div className="mt-2 border-t border-border/50 pt-2">
                        {loadingLog ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : logEntries.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nessun invio registrato.</p>
                        ) : (
                          <div className="max-h-48 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">ID Iscrizione</TableHead>
                                  <TableHead className="text-xs">Stato</TableHead>
                                  <TableHead className="text-xs">Data</TableHead>
                                  <TableHead className="text-xs">Errore</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {logEntries.map(l => (
                                  <TableRow key={l.id}>
                                    <TableCell className="text-xs font-mono">{l.registration_id.slice(0, 8)}…</TableCell>
                                    <TableCell>
                                      <Badge variant={l.status === "sent" ? "default" : "destructive"} className="text-xs">
                                        {l.status === "sent" ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                                        {l.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs">{new Date(l.sent_at).toLocaleString("it-IT")}</TableCell>
                                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">{l.error || "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Editor dialog */}
      {isEditing && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">{editTemplate ? "Modifica template" : "Nuovo template"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Slug</Label>
                <Input
                  value={editFields.slug || ""}
                  onChange={e => setEditFields(f => ({ ...f, slug: e.target.value }))}
                  placeholder="es. pre-gara"
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Trigger</Label>
                <Select value={editFields.trigger_type} onValueChange={v => setEditFields(f => ({ ...f, trigger_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manuale</SelectItem>
                    <SelectItem value="on_payment">Automatica (al pagamento)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Oggetto</Label>
              <Input
                value={editFields.subject || ""}
                onChange={e => setEditFields(f => ({ ...f, subject: e.target.value }))}
                placeholder="Supporta {nome}, {cognome}"
                className="text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Body HTML <span className="text-muted-foreground">(placeholder: {"{nome}"}, {"{cognome}"}, {"{orario}"}, {"{disciplina}"})</span></Label>
              <Textarea
                value={editFields.body_html || ""}
                onChange={e => setEditFields(f => ({ ...f, body_html: e.target.value }))}
                rows={12}
                className="text-xs font-mono"
              />
              {editFields.body_html && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => showPreview(editFields.body_html)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Anteprima
                </Button>
              )}
            </div>

            {/* Orario map */}
            <div>
              <Label className="text-xs">Mappa orari (disciplina → orario)</Label>
              <div className="space-y-2 mt-1">
                {orarioEntries.map(([k, v], i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      value={k}
                      onChange={e => {
                        const updated = [...orarioEntries];
                        updated[i] = [e.target.value, v];
                        setOrarioEntries(updated);
                      }}
                      placeholder="Disciplina"
                      className="text-sm flex-1"
                    />
                    <Input
                      value={v}
                      onChange={e => {
                        const updated = [...orarioEntries];
                        updated[i] = [k, e.target.value];
                        setOrarioEntries(updated);
                      }}
                      placeholder="Orario"
                      className="text-sm w-24"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOrarioEntries(orarioEntries.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={() => setOrarioEntries([...orarioEntries, ["", ""]])}>
                  <Plus className="h-3 w-3 mr-1" /> Aggiungi
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setEditTemplate(null); setShowNew(false); }}>Annulla</Button>
              <Button onClick={saveTemplate} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Salva
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk send confirm */}
      <AlertDialog open={!!confirmBulk} onOpenChange={() => { setConfirmBulk(null); setSendProgress(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma invio massivo</AlertDialogTitle>
            <AlertDialogDescription>
              {sendProgress ? (
                <div className="space-y-3">
                  <p>Invio completato:</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-600 font-medium">✓ {sendProgress.sent} inviate</span>
                    {sendProgress.failed > 0 && <span className="text-red-600 font-medium">✗ {sendProgress.failed} errori</span>}
                    <span className="text-muted-foreground">su {sendProgress.total} totali</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p><strong>{bulkCount.pending}</strong> email da inviare su <strong>{bulkCount.total}</strong> iscritti completati.</p>
                  {bulkCount.pending === 0 && <p className="text-amber-600">Tutte le email sono già state inviate.</p>}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Chiudi</AlertDialogCancel>
            {!sendProgress && bulkCount.pending > 0 && (
              <AlertDialogAction onClick={executeBulk} disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Invia {bulkCount.pending} email
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test send dialog */}
      <Dialog open={!!showTestDialog} onOpenChange={() => setShowTestDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invia email di test</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Email destinatario</Label>
            <Input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="test@esempio.it"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(null)}>Annulla</Button>
            <Button onClick={sendTestEmail} disabled={sendingTest || !testEmail}>
              {sendingTest ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Invia test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anteprima email</DialogTitle>
          </DialogHeader>
          {previewHtml && (
            <div className="border rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                className="w-full min-h-[500px] border-0"
                sandbox=""
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
