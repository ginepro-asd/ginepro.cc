import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  participant: { id: string; nome: string; cognome: string; email: string; telefono: string };
}

const defaultText = (nome: string) =>
  `Ciao ${nome}, scrivo da Ginepro. Per completare la tua iscrizione potresti indicarci la società sportiva di appartenenza? Grazie!`;

const SocietaRequestActions = ({ participant }: Props) => {
  const { toast } = useToast();
  const [emailOpen, setEmailOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [text, setText] = useState(defaultText(participant.nome));
  const [sending, setSending] = useState(false);

  const sendEmail = () => {
    const subject = "Società di appartenenza";
    const url = `mailto:${participant.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = url;
    setEmailOpen(false);
  };

  const openWhatsApp = () => {
    const phone = (participant.telefono || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (!phone) {
      toast({ title: "Telefono mancante", variant: "destructive" });
      return;
    }
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setWaOpen(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setText(defaultText(participant.nome)); setEmailOpen(true); }}>
        <Mail className="h-4 w-4 mr-1.5" /> Richiedi via Email
      </Button>
      <Button size="sm" variant="outline" onClick={() => { setText(defaultText(participant.nome)); setWaOpen(true); }}>
        <MessageCircle className="h-4 w-4 mr-1.5" /> Richiedi via WhatsApp
      </Button>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Richiedi società via email</DialogTitle>
            <DialogDescription>A: {participant.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-sm">Messaggio</Label>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailOpen(false)}>Annulla</Button>
            <Button onClick={sendEmail}>Apri client email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Richiedi società via WhatsApp</DialogTitle>
            <DialogDescription>A: {participant.telefono || "—"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-sm">Messaggio</Label>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaOpen(false)}>Annulla</Button>
            <Button onClick={openWhatsApp}>Apri WhatsApp</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SocietaRequestActions;
