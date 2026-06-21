import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useEvent } from "@/hooks/use-event";
import RegistrationForm from "@/components/RegistrationForm";

interface AdminAddRegistrationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventSlug: string;
  onSuccess: () => void;
}

const AdminAddRegistration = ({ open, onOpenChange, eventSlug, onSuccess }: AdminAddRegistrationProps) => {
  const { data: event, isLoading } = useEvent(open ? eventSlug : undefined, { includeInactive: true });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Aggiungi iscritto</DialogTitle>
          <DialogDescription>
            Stesso modulo dell'iscrizione pubblica. Pagamento ammesso: Satispay o Contanti.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !event ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <RegistrationForm
            event={event}
            adminBypass
            onCompleted={() => {
              onOpenChange(false);
              onSuccess();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminAddRegistration;
