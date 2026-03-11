import { useEffect, useState } from "react";
import { useSearchParams, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, XCircle, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoDark from "@/assets/icon-mountain.png";

interface RegistrationData {
  nome: string;
  cognome: string;
  email: string;
  payment_method: string;
  participant_id?: string | null;
}

interface CardData {
  id: string;
  card_number: string;
}

const Conferma = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "paid" | "error">("loading");
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [memberCard, setMemberCard] = useState<CardData | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const registrationId = searchParams.get("registration_id");
    const provider = searchParams.get("provider");

    if (!registrationId) {
      setStatus("error");
      return;
    }

    if (provider === "satispay") {
      const fetchRegistration = async () => {
        try {
          const { data, error } = await supabase
            .from("registrations")
            .select("nome, cognome, email, payment_method, participant_id")
            .eq("id", registrationId)
            .single();
          if (error) throw error;
          setRegistration(data);
          // Check for membership card
          const { data: cards } = await supabase
            .from("membership_cards")
            .select("id, card_number")
            .eq("registration_id", registrationId)
            .limit(1);
          if (cards && cards.length > 0) setMemberCard(cards[0]);
          setStatus("paid");
        } catch {
          setStatus("error");
        }
      };
      fetchRegistration();
      return;
    }

    if (provider === "paypal") {
      const token = searchParams.get("token");
      const orderId = token || searchParams.get("order_id");
      const capturePaypal = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("capture-paypal-order", {
            body: { order_id: orderId, registration_id: registrationId },
          });
          if (error) throw error;
          if (data.status === "completed") {
            setStatus("paid");
            setRegistration(data.registration);
            if (data.card) setMemberCard(data.card);
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
        if (data.status === "completed") {
          setStatus("paid");
          setRegistration(data.registration);
          if (data.card) setMemberCard(data.card);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    verify();
  }, [searchParams]);

  const homePath = slug ? `/${slug}` : "/";

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
                  {memberCard ? "Tesseramento completato!" : "Iscrizione confermata!"}
                </h1>
                <p className="text-muted-foreground mb-6">
                  {memberCard ? "Benvenuto in GINEPRO ASD!" : "Grazie per esserti iscritto."}
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
                {memberCard && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">N° Tessera:</span>{" "}
                    <strong className="text-foreground font-mono">{memberCard.card_number}</strong>
                  </p>
                )}
              </div>

              {memberCard && (
                <>
                  <Button asChild className="w-full">
                    <Link to={`/card/${memberCard.id}`}>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Visualizza la tua tessera
                    </Link>
                  </Button>
                  {registration.participant_id && (
                    <Button asChild variant="outline" className="w-full">
                      <Link to={`/area-riservata/setup?participant_id=${registration.participant_id}`}>
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Configura la tua area riservata
                      </Link>
                    </Button>
                  )}
                </>
              )}
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="h-16 w-16 mx-auto text-destructive" />
              <div>
                <h1 className="font-display text-2xl font-bold text-foreground mb-2">Errore nella verifica</h1>
                <p className="text-muted-foreground">
                  Non è stato possibile verificare il pagamento. Contattaci se hai completato il pagamento.
                </p>
              </div>
            </>
          )}

          <Button asChild variant="outline" className="mt-4">
            <Link to={homePath}>Torna alla home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Conferma;
