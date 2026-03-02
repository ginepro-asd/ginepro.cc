import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle, XCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface SatispayWaitingProps {
  paymentId: string;
  registrationId: string;
  onCancel: () => void;
}

const SatispayWaiting = ({ paymentId, registrationId, onCancel }: SatispayWaitingProps) => {
  const [status, setStatus] = useState<"pending" | "paid" | "cancelled" | "error">("pending");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkPayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("check-satispay-payment", {
          body: { payment_id: paymentId, registration_id: registrationId },
        });

        if (error) throw error;

        if (data.status === "completed") {
          setStatus("paid");
          if (intervalRef.current) clearInterval(intervalRef.current);
          setTimeout(() => {
            navigate(`/conferma?registration_id=${registrationId}&provider=satispay`);
          }, 2000);
        } else if (data.status === "cancelled") {
          setStatus("cancelled");
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Keep polling on transient errors
      }
    };

    checkPayment();
    intervalRef.current = setInterval(checkPayment, 3000);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStatus("error");
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [paymentId, registrationId, navigate]);

  return (
    <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
      <CardContent className="pt-8 pb-8 text-center space-y-6">
        {status === "pending" && (
          <>
            <div className="relative mx-auto w-20 h-20">
              <Smartphone className="h-12 w-12 absolute inset-0 m-auto text-primary" />
              <Loader2 className="h-20 w-20 absolute inset-0 animate-spin text-primary/30" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                In attesa del pagamento
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Apri l'app Satispay sul tuo telefono e conferma il pagamento di <strong className="text-secondary">14,99€</strong>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Annulla
            </Button>
          </>
        )}

        {status === "paid" && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                Pagamento ricevuto!
              </h3>
              <p className="text-muted-foreground text-sm">Reindirizzamento alla conferma...</p>
            </div>
          </>
        )}

        {(status === "cancelled" || status === "error") && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">
                {status === "cancelled" ? "Pagamento annullato" : "Tempo scaduto"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {status === "cancelled"
                  ? "Il pagamento è stato annullato."
                  : "Non abbiamo ricevuto il pagamento in tempo."}
              </p>
            </div>
            <Button variant="outline" onClick={onCancel}>
              Riprova
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SatispayWaiting;
