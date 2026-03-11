import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";
import { MatchedRegistration, obfuscateEmail, obfuscatePhone, obfuscateCF } from "@/lib/registration-utils";

interface ReturningUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchedUsers: MatchedRegistration[];
  onSelect: (match: MatchedRegistration) => void;
  onDismiss: () => void;
}

const ReturningUserDialog = ({ open, onOpenChange, matchedUsers, onSelect, onDismiss }: ReturningUserDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); else onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="h-5 w-5 text-primary" />
            <DialogTitle className="font-display">Ci conosciamo già?</DialogTitle>
          </div>
          <DialogDescription>
            Abbiamo trovato {matchedUsers.length > 1 ? "alcune iscrizioni" : "un'iscrizione"} con il tuo nome. Sei tu?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {matchedUsers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className="w-full text-left border border-border rounded-lg p-4 hover:border-primary hover:bg-primary/5 transition-all space-y-1"
            >
              <div className="flex items-start gap-3">
                {m.photo_thumb_url && (
                  <img src={m.photo_thumb_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
                )}
                <div className="space-y-1 min-w-0">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-medium font-mono text-foreground">{obfuscateEmail(m.email)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Telefono: </span>
                    <span className="font-medium font-mono text-foreground">{obfuscatePhone(m.telefono)}</span>
                  </div>
                  {m.codice_fiscale && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">C.F.: </span>
                      <span className="font-medium font-mono text-foreground">{obfuscateCF(m.codice_fiscale)}</span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onDismiss}>
            No, sono un nuovo iscritto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReturningUserDialog;
