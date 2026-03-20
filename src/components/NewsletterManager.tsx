import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Eye, Send, Loader2, Mail, Users, TestTube, MousePointerClick, UserMinus, CheckCircle } from "lucide-react";

interface Newsletter {
  id: string;
  slug: string;
  subject: string;
  cta_url: string;
  body_html: string | null;
  created_at: string;
  sent_at: string | null;
}

interface NewsletterStats {
  clicks: number;
  unsubscribes: number;
}

interface Props {
  password: string;
}

const NewsletterManager = ({ password }: Props) => {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [stats, setStats] = useState<Record<string, NewsletterStats>>({});
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendTarget, setSendTarget] = useState<Newsletter | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    id: "", slug: "", subject: "", cta_url: "", body_html: "",
  });
  const [isNew, setIsNew] = useState(true);

  const fetchNewsletters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("newsletters")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) {
      setNewsletters(data as Newsletter[]);
      // Fetch stats for all newsletters
      const ids = data.map((n: any) => n.id);
      if (ids.length > 0) {
        const [clicksRes, unsubsRes] = await Promise.all([
          supabase.from("newsletter_clicks").select("newsletter_id").in("newsletter_id", ids),
          supabase.from("newsletter_unsubscribes").select("newsletter_id").in("newsletter_id", ids),
        ]);
        const statsMap: Record<string, NewsletterStats> = {};
        ids.forEach((id: string) => { statsMap[id] = { clicks: 0, unsubscribes: 0 }; });
        clicksRes.data?.forEach((r: any) => { if (statsMap[r.newsletter_id]) statsMap[r.newsletter_id].clicks++; });
        unsubsRes.data?.forEach((r: any) => { if (statsMap[r.newsletter_id]) statsMap[r.newsletter_id].unsubscribes++; });
        setStats(statsMap);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchNewsletters(); }, []);

  const openNew = () => {
    setIsNew(true);
    setFormData({ id: "", slug: "", subject: "", cta_url: "", body_html: "" });
    setEditDialog(true);
  };

  const openEdit = (nl: Newsletter) => {
    setIsNew(false);
    setFormData({ id: nl.id, slug: nl.slug, subject: nl.subject, cta_url: nl.cta_url, body_html: nl.body_html || "" });
    setEditDialog(true);
  };

  const openPreview = (nl: Newsletter) => {
    const html = (nl.body_html || "")
      .replace(/\{\{nome\}\}/g, "Mario")
      .replace(/\{\{cta_link\}\}/g, nl.cta_url)
      .replace(/\{\{unsubscribe_link\}\}/g, "#");
    setPreviewHtml(html);
    setPreviewDialog(true);
  };

  const saveNewsletter = async () => {
    if (!formData.slug || !formData.subject) {
      toast({ title: "Errore", description: "Slug e soggetto sono obbligatori.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const newsletter = {
        ...(formData.id ? { id: formData.id } : {}),
        slug: formData.slug,
        subject: formData.subject,
        cta_url: formData.cta_url,
        body_html: formData.body_html || null,
      };
      const { error } = await supabase.functions.invoke("manage-event", {
        body: { password, action: "upsert_newsletter", newsletter },
      });
      if (error) throw error;
      toast({ title: "Salvato", description: "Newsletter salvata con successo." });
      setEditDialog(false);
      fetchNewsletters();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendTest = async (nl: Newsletter) => {
    if (!testEmail) {
      toast({ title: "Errore", description: "Inserisci un'email per il test.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { newsletter_slug: nl.slug, test_email: testEmail },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Test inviato", description: `Email di test inviata a ${testEmail}` });
      setSendTarget(null);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendBulk = async (nl: Newsletter) => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-newsletter", {
        body: { newsletter_slug: nl.slug },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const remaining = data.remaining ?? 0;
      const alreadySent = data.already_sent ?? 0;
      toast({
        title: remaining > 0 ? "Batch inviato" : "Invio completato",
        description: `${data.sent} email inviate in questo batch, ${data.errors} errori. Totale inviate: ${alreadySent + data.sent}/${data.total}.${remaining > 0 ? ` Rimanenti: ${remaining}` : ""}`,
      });
      setBulkConfirm(false);
      if (remaining === 0) {
        setSendTarget(null);
      }
      fetchNewsletters();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Newsletter
        </h2>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuova
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : newsletters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessuna newsletter creata. Clicca "Nuova" per iniziare.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slug</TableHead>
                <TableHead>Soggetto</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center gap-1 justify-center">
                    <MousePointerClick className="h-3.5 w-3.5" /> Click
                  </span>
                </TableHead>
                <TableHead className="text-center">
                  <span className="flex items-center gap-1 justify-center">
                    <UserMinus className="h-3.5 w-3.5" /> Unsub
                  </span>
                </TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newsletters.map((nl) => {
                const nlStats = stats[nl.id] || { clicks: 0, unsubscribes: 0 };
                const isSent = !!nl.sent_at;
                return (
                  <TableRow key={nl.id}>
                    <TableCell className="font-mono text-xs">{nl.slug}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{nl.subject}</TableCell>
                    <TableCell>
                      {isSent ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Inviata {new Date(nl.sent_at!).toLocaleDateString("it-IT")}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Bozza</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-medium">{nlStats.clicks}</TableCell>
                    <TableCell className="text-center font-medium">{nlStats.unsubscribes}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(nl)} title="Modifica">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openPreview(nl)} title="Preview" disabled={!nl.body_html}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setSendTarget(nl); setTestEmail(""); }}
                          title={isSent ? "Già inviata" : "Invia"}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuova Newsletter" : "Modifica Newsletter"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} placeholder="es. newsletter-estate-2026" disabled={!isNew} />
              </div>
              <div className="space-y-2">
                <Label>CTA URL</Label>
                <Input value={formData.cta_url} onChange={(e) => setFormData({ ...formData, cta_url: e.target.value })} placeholder="https://ginepro.cc/..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Soggetto</Label>
              <Input value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="es. Ciao <Nome>, scopri il prossimo evento!" />
            </div>
            <div className="space-y-2">
              <Label>
                Body HTML
                <span className="text-xs text-muted-foreground ml-2">
                  Placeholder: {"{{nome}}"}, {"{{cta_link}}"}, {"{{unsubscribe_link}}"}
                </span>
              </Label>
              <Textarea value={formData.body_html} onChange={(e) => setFormData({ ...formData, body_html: e.target.value })} placeholder="<html>...</html>" className="font-mono text-xs min-h-[300px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Annulla</Button>
            <Button onClick={saveNewsletter} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview Newsletter</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe srcDoc={previewHtml} className="w-full min-h-[500px] border-0" title="Newsletter Preview" sandbox="" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={!!sendTarget && !bulkConfirm} onOpenChange={(open) => { if (!open) setSendTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invia Newsletter</DialogTitle>
          </DialogHeader>
          {sendTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Newsletter: <strong>{sendTarget.subject}</strong>
              </p>

              {sendTarget.sent_at && (
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Questa newsletter è stata inviata il{" "}
                    <strong>{new Date(sendTarget.sent_at).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</strong>.
                    L'invio massivo non è più disponibile.
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Invio di test
                  </Label>
                  <div className="flex gap-2">
                    <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="email@esempio.com" />
                    <Button onClick={() => sendTest(sendTarget)} disabled={sending || !testEmail} variant="outline">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {!sendTarget.sent_at && (
                  <div className="border-t pt-3">
                    <Button onClick={() => setBulkConfirm(true)} variant="default" className="w-full" disabled={!sendTarget.body_html}>
                      <Users className="h-4 w-4 mr-2" />
                      Invio massivo a tutti gli iscritti
                    </Button>
                    {!sendTarget.body_html && (
                      <p className="text-xs text-destructive mt-1">Aggiungi il body HTML prima di inviare.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Confirm */}
      <AlertDialog open={bulkConfirm} onOpenChange={setBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma invio massivo</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per inviare la newsletter "{sendTarget?.subject}" a tutti i partecipanti iscritti alla newsletter. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => sendTarget && sendBulk(sendTarget)} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Invia a tutti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NewsletterManager;
