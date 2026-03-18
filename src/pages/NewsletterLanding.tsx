import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Mail, MailX } from "lucide-react";

type Newsletter = {
  id: string;
  slug: string;
  subject: string;
  cta_url: string;
};

export default function NewsletterLanding() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const action = searchParams.get("action"); // "unsubscribe" or "cta"
  const participantId = searchParams.get("pid");

  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionDone, setActionDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from("newsletters")
      .select("*")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) {
          setError("Newsletter non trovata.");
        } else {
          setNewsletter(data as Newsletter);
        }
        setLoading(false);
      });
  }, [slug]);

  // Auto-handle CTA action: track click and redirect
  useEffect(() => {
    if (!newsletter || !participantId || action !== "cta") return;

    const trackAndRedirect = async () => {
      // Record click (ignore duplicate errors due to UNIQUE constraint)
      await supabase.from("newsletter_clicks").insert({
        newsletter_id: newsletter.id,
        participant_id: participantId,
      });
      // Redirect to CTA URL
      window.location.href = newsletter.cta_url;
    };

    trackAndRedirect();
  }, [newsletter, participantId, action]);

  const handleUnsubscribe = async () => {
    if (!participantId) {
      setError("Link non valido: manca il riferimento utente.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase
      .from("participants")
      .update({ newsletter: false })
      .eq("id", participantId);

    if (err) {
      setError("Errore durante la disiscrizione. Riprova più tardi.");
    } else {
      setActionDone(true);
    }
    setLoading(false);
  };

  if (loading || (action === "cta" && newsletter && participantId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">{error}</h1>
        </Card>
      </div>
    );
  }

  // Unsubscribe flow
  if (action === "unsubscribe") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6">
          {actionDone ? (
            <>
              <MailX className="h-14 w-14 text-primary mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">Disiscritto</h1>
              <p className="text-muted-foreground">
                Non riceverai più le nostre newsletter. Se cambi idea, potrai
                sempre reiscriverti contattandoci.
              </p>
            </>
          ) : (
            <>
              <Mail className="h-14 w-14 text-primary mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">
                Vuoi disiscriverti dalla newsletter?
              </h1>
              <p className="text-muted-foreground">
                {newsletter?.subject
                  ? `Newsletter: "${newsletter.subject}"`
                  : "Non riceverai più le nostre comunicazioni."}
              </p>
              <Button onClick={handleUnsubscribe} variant="destructive" className="w-full">
                Confermo, disiscrivimi
              </Button>
            </>
          )}
        </Card>
      </div>
    );
  }

  // Default: show newsletter info (fallback if no action param)
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <CheckCircle className="h-14 w-14 text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">
          {newsletter?.subject ?? "Newsletter"}
        </h1>
        {newsletter?.cta_url && (
          <Button asChild className="w-full">
            <a href={newsletter.cta_url}>Vai al contenuto</a>
          </Button>
        )}
      </Card>
    </div>
  );
}
