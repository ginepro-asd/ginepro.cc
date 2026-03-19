import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Eye, Send, Loader2, Mail, Users, TestTube } from "lucide-react";

interface Newsletter {
  id: string;
  slug: string;
  subject: string;
  cta_url: string;
  body_html: string | null;
  created_at: string;
}

interface Props {
  password: string;
}

const NewsletterManager = ({ password }: Props) => {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendTarget, setSendTarget] = useState<Newsletter | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    id: "",
    slug: "",
    subject: "",
    cta_url: "",
    body_html: "",
  });
  const [isNew, setIsNew] = useState(true);

  const fetchNewsletters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("newsletters")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setNewsletters(data);
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
    setFormData({
      id: nl.id,
      slug: nl.slug,
      subject: nl.subject,
      cta_url: nl.cta_url,
      body_html: nl.body_html || "",
    });
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
      if (isNew) {
        const { error } = await supabase.functions.invoke("manage-event", {
          body: {
            password,
            action: "upsert_newsletter",
            newsletter: {
              slug: formData.slug,
              subject: formData.subject,
              cta_url: formData.cta_url,
              body_html: formData.body_html || null,
            },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.functions.invoke("manage-event", {
          body: {
            password,
            action: "upsert_newsletter",
            newsletter: {
              id: formData.id,
              slug: formData.slug,
              subject: formData.subject,
              cta_url: formData.cta_url,
              body_html: formData.body_html || null,
            },
          },
        });
        if (error) throw error;
      }
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
      toast({
        title: "Invio completato",
        description: `${data.sent} email inviate, ${data.errors} errori su ${data.total} destinatari.`,
      });
      setBulkConfirm(false);
      setSendTarget(null);
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
                <TableHead>HTML</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {newsletters.map((nl) => (
                <TableRow key={nl.id}>
                  <TableCell className="font-mono text-xs">{nl.slug}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{nl.subject}</TableCell>
                  <TableCell>
                    {nl.body_html ? (
                      <Badge variant="default" className="text-xs">Sì</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(nl.created_at).toLocaleDateString("it-IT")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(nl)} title="Modifica">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openPreview(nl)} title="Preview" disabled={!nl.body_html}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSendTarget(nl); setTestEmail(""); }} title="Invia">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
                <Input
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="es. newsletter-estate-2026"
                  disabled={!isNew}
                />
              </div>
              <div className="space-y-2">
                <Label>CTA URL</Label>
                <Input
                  value={formData.cta_url}
                  onChange={(e) => setFormData({ ...formData, cta_url: e.target.value })}
                  placeholder="https://ginepro.cc/..."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Soggetto</Label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="es. Ciao <Nome>, scopri il prossimo evento!"
              />
            </div>
            <div className="space-y-2">
              <Label>
                Body HTML
                <span className="text-xs text-muted-foreground ml-2">
                  Placeholder: {"{{nome}}"}, {"{{cta_link}}"}, {"{{unsubscribe_link}}"}
                </span>
              </Label>
              <Textarea
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                placeholder="<html>...</html>"
                className="font-mono text-xs min-h-[300px]"
              />
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
            <iframe
              srcDoc={previewHtml}
              className="w-full min-h-[500px] border-0"
              title="Newsletter Preview"
              sandbox=""
            />
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

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Invio di test
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="email@esempio.com"
                    />
                    <Button onClick={() => sendTest(sendTarget)} disabled={sending || !testEmail} variant="outline">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <Button
                    onClick={() => setBulkConfirm(true)}
                    variant="default"
                    className="w-full"
                    disabled={!sendTarget.body_html}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Invio massivo a tutti gli iscritti
                  </Button>
                  {!sendTarget.body_html && (
                    <p className="text-xs text-destructive mt-1">
                      Aggiungi il body HTML prima di inviare.
                    </p>
                  )}
                </div>
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
