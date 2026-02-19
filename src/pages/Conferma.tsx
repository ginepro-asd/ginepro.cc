import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoDark from "@/assets/icon-mountain.png";

interface RegistrationData {
  nome: string;
  cognome: string;
  email: string;
  payment_method: string;
}

const Conferma = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "paid" | "error">("loading");
  const [registration, setRegistration] = useState<RegistrationData | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const registrationId = searchParams.get("registration_id");
    const provider = searchParams.get("provider");

    if (!registrationId) {
      setStatus("error");
      return;
    }

    // Satispay flow — payment already verified by polling
    if (provider === "satispay") {
      const fetchRegistration = async () => {
        try {
          const { data, error } = await supabase
            .from("registrations")
            .select("nome, cognome, email, payment_method")
            .eq("id", registrationId)
            .single();
          if (error) throw error;
          setRegistration(data);
          setStatus("paid");
        } catch {
          setStatus("error");
        }
      };
      fetchRegistration();
      return;
    }

    // PayPal flow — capture the order after redirect
    if (provider === "paypal") {
      const token = searchParams.get("token"); // PayPal passes order ID as token
      const orderId = token || searchParams.get("order_id");
      
      const capturePaypal = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("capture-paypal-order", {
            body: { order_id: orderId, registration_id: registrationId },
          });
          if (error) throw error;
          if (data.status === "paid") {
            setStatus("paid");
            setRegistration(data.registration);
          } else {
            setStatus("error");
          }
        } catch {
          setStatus("error");
        }
      };
      capturePaypal();
      return;
    }

    // Stripe flow
    if (!sessionId) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { session_id: sessionId, registration_id: registrationId },
        });

        if (error) throw error;

        if (data.status === "paid") {
          setStatus("paid");
          setRegistration(data.registration);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <Card className="max-w-md w-full border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <img src={logoDark} alt="GINEPRO" className="h-12 mx-auto object-contain" />

          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">Verifica del pagamento in corso...</p>
            </>
          )}

          {status === "paid" && registration && (
            <>
              <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                  Iscrizione confermata!
                </h1>
                <p className="text-muted-foreground mb-6">
                  Grazie per esserti iscritto al Tredozio Trail 2027.
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">Nome:</span>{" "}
                  <strong className="text-foreground">{registration.nome} {registration.cognome}</strong>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <strong className="text-foreground">{registration.email}</strong>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Pagamento:</span>{" "}
                  <strong className="text-foreground capitalize">{registration.payment_method}</strong>
                </p>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 mx-auto text-destructive" />
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground mb-2">
                  Errore nella verifica
                </h1>
                <p className="text-muted-foreground">
                  Non è stato possibile verificare il pagamento. Contattaci se hai completato il pagamento.
                </p>
              </div>
            </>
          )}

          <Button asChild variant="outline" className="mt-4">
            <Link to="/">Torna alla home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Conferma;
