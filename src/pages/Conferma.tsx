import { useEffect, useState } from "react";
import { useSearchParams, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, XCircle, CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import logoDark from "@/assets/icon-mountain.png";
import SiteFooter from "@/components/SiteFooter";

interface RegistrationData {
  nome: string;
  cognome: string;
  email: string;
  payment_method: string;
  participant_id?: string | null;
  custom_data?: any;
  payment_id?: string | null;
}

interface CardData {
  id: string;
  card_number: string;
}

interface PairMate {
  nome: string;
  cognome: string;
  pettorale: string | null;
}

const Conferma = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "paid" | "error">("loading");
  const [registration, setRegistration] = useState<RegistrationData | null>(null);
  const [memberCard, setMemberCard] = useState<CardData | null>(null);
  const [pairMate, setPairMate] = useState<PairMate | null>(null);

  const isPair = searchParams.get("pair") === "true";
  const tokenParam = searchParams.get("token");

  // Fetch the pair partner if needed
  const loadPairMate = async (reg: RegistrationData, registrationId: string) => {
    if (!reg.payment_id) return;
    const { data: mates } = await supabase
      .from("registrations")
      .select("nome, cognome, custom_data")
      .eq("payment_id", reg.payment_id)
      .neq("id", registrationId);
    if (mates && mates.length > 0) {
      const m = mates[0];
      const cd = m.custom_data as Record<string, any> | null;
      setPairMate({ nome: m.nome, cognome: m.cognome, pettorale: cd?.pettorale ?? null });
    }
  };

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const registrationId = searchParams.get("registration_id");
    const provider = searchParams.get("provider");

    if (!registrationId) {
      setStatus("error");
      return;
    }

    const fetchRegAndCard = async (markPaid = true) => {
      const { data, error } = await supabase
        .from("registrations")
        .select("nome, cognome, email, payment_method, participant_id, custom_data, payment_id")
        .eq("id", registrationId)
        .single();
      if (error) throw error;
      setRegistration(data);
      const { data: cards } = await supabase
        .from("membership_cards")
        .select("id, card_number")
        .eq("registration_id", registrationId)
        .limit(1);
      if (cards && cards.length > 0) setMemberCard(cards[0]);
      if (isPair) await loadPairMate(data, registrationId);
      if (markPaid) setStatus("paid");
    };

    if (provider === "satispay" || provider === "contanti") {
      fetchRegAndCard().catch(() => setStatus("error"));
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
            if (isPair && data.registration) await loadPairMate(data.registration, registrationId);
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
          if (isPair && data.registration) await loadPairMate(data.registration, registrationId);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    };
    verify();
  }, [searchParams]);

  // Preserve admin token when returning home
  const isAdmin = tokenParam === "gin";
  const homePath = slug ? `/${slug}${isAdmin ? "?token=gin" : ""}` : "/";

  const myPettorale = registration?.custom_data?.pettorale ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-16">
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
                {myPettorale && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Pettorale:</span>{" "}
                    <strong className="text-foreground font-mono text-base">{myPettorale}</strong>
                  </p>
                )}
                {pairMate && (
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <p className="text-sm">
                      <span className="text-muted-foreground">Compagno/a:</span>{" "}
                      <strong className="text-foreground">{pairMate.nome} {pairMate.cognome}</strong>
                    </p>
                    {pairMate.pettorale && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Pettorale compagno/a:</span>{" "}
                        <strong className="text-foreground font-mono text-base">{pairMate.pettorale}</strong>
                      </p>
                    )}
                  </div>
                )}
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
      <SiteFooter adminPath={slug ? `/${slug}/admin` : "/admin"} />
    </div>
  );
};

export default Conferma;
