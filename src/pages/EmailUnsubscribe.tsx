import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2, MailCheck, MailX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type UnsubscribeState = "loading" | "ready" | "success" | "already" | "invalid" | "error";

export default function EmailUnsubscribe() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token"), [searchParams]);
  const [state, setState] = useState<UnsubscribeState>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("Stiamo verificando il tuo link...");

  useEffect(() => {
    let cancelled = false;

    const validateToken = async () => {
      if (!token) {
        if (!cancelled) {
          setState("invalid");
          setMessage("Il link di disiscrizione non è valido o è incompleto.");
        }
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          {
            headers: {
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          },
        );

        const data = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.ok && data.valid) {
          setState("ready");
          setMessage("Conferma la disiscrizione per non ricevere più queste email.");
          return;
        }

        if (data.reason === "already_unsubscribed") {
          setState("already");
          setMessage("Questo indirizzo risulta già disiscritto.");
          return;
        }

        setState(response.status === 404 ? "invalid" : "error");
        setMessage(data.error || "Non siamo riusciti a verificare il link di disiscrizione.");
      } catch {
        if (!cancelled) {
          setState("error");
          setMessage("Errore temporaneo durante la verifica del link.");
        }
      }
    };

    validateToken();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleConfirm = async () => {
    if (!token || submitting) return;

    setSubmitting(true);

    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });

    if (error) {
      setState("error");
      setMessage("Non siamo riusciti a completare la disiscrizione. Riprova tra poco.");
      setSubmitting(false);
      return;
    }

    if (data?.success) {
      setState("success");
      setMessage("La tua disiscrizione è stata confermata con successo.");
    } else if (data?.reason === "already_unsubscribed") {
      setState("already");
      setMessage("Questo indirizzo risultava già disiscritto.");
    } else {
      setState("error");
      setMessage("Non siamo riusciti a completare la disiscrizione.");
    }

    setSubmitting(false);
  };

  const icon = (() => {
    switch (state) {
      case "loading":
        return <Loader2 className="h-10 w-10 animate-spin text-primary" />;
      case "ready":
        return <MailX className="h-10 w-10 text-primary" />;
      case "success":
      case "already":
        return <MailCheck className="h-10 w-10 text-primary" />;
      default:
        return <AlertCircle className="h-10 w-10 text-destructive" />;
    }
  })();

  const title = (() => {
    switch (state) {
      case "ready":
        return "Conferma la disiscrizione";
      case "success":
        return "Disiscrizione completata";
      case "already":
        return "Sei già disiscritto";
      case "invalid":
        return "Link non valido";
      case "error":
        return "Qualcosa è andato storto";
      default:
        return "Verifica in corso";
    }
  })();

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-10 text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--secondary)/0.18),transparent_35%),radial-gradient(circle_at_bottom_right,hsl(var(--primary)/0.16),transparent_40%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <Card className="w-full max-w-xl overflow-hidden border-border/70 bg-card/95 shadow-2xl backdrop-blur">
          <div className="border-b border-border/70 bg-primary px-8 py-8 text-primary-foreground">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-secondary">Ginepro app emails</p>
            <h1 className="font-heading text-3xl font-extrabold">Gestione disiscrizione</h1>
          </div>

          <div className="space-y-6 px-8 py-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">{icon}</div>

            <div className="space-y-3">
              <h2 className="font-heading text-2xl font-bold text-foreground">{title}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{message}</p>
            </div>

            {state === "ready" ? (
              <div className="space-y-3">
                <Button className="w-full" disabled={submitting} onClick={handleConfirm}>
                  {submitting ? "Disiscrizione in corso..." : "Conferma disiscrizione"}
                </Button>
                <Button asChild className="w-full" variant="outline">
                  <Link to="/">Annulla e torna al sito</Link>
                </Button>
              </div>
            ) : (
              <Button asChild className="w-full" variant="outline">
                <Link to="/">Torna agli eventi</Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}