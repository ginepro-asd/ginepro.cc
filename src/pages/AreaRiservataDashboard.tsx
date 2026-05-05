import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2, LogOut, CreditCard, CalendarDays, User, FileCheck, ExternalLink,
} from "lucide-react";
import logoDark from "@/assets/icon-mountain.png";
import SiteFooter from "@/components/SiteFooter";

interface ParticipantData {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  codice_fiscale: string | null;
  birth_date: string | null;
  birth_place: string | null;
  photo_thumb_url: string | null;
}

interface RegistrationRow {
  id: string;
  nome: string;
  cognome: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  custom_data: any;
  event_id: string | null;
  events: { nome: string; data_evento: string | null; slug: string } | null;
}

interface MemberCardRow {
  id: string;
  card_number: string;
  year: number;
}

interface CertificateRow {
  id: string;
  expiry_date: string | null;
  ai_warning: string | null;
  disciplines: string[] | null;
  uploaded_at: string;
}

const AreaRiservataDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [participant, setParticipant] = useState<ParticipantData | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [cards, setCards] = useState<MemberCardRow[]>([]);
  const [certificates, setCertificates] = useState<CertificateRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/area-riservata", { replace: true });
        return;
      }

      const authUserId = session.user.id;

      // Get participant linked to this auth user
      const { data: part } = await (supabase
        .from("participants")
        .select("id, nome, cognome, email, telefono, codice_fiscale, birth_date, birth_place, photo_thumb_url") as any)
        .eq("auth_user_id", authUserId)
        .single();

      if (!part) {
        navigate("/area-riservata", { replace: true });
        return;
      }

      setParticipant(part);

      // Fetch registrations, cards, certificates in parallel
      const [regsRes, cardsRes, certsRes] = await Promise.all([
        supabase
          .from("registrations")
          .select("id, nome, cognome, payment_status, payment_method, created_at, custom_data, event_id, events(nome, data_evento, slug)")
          .eq("participant_id", part.id)
          .eq("payment_status", "completed")
          .order("created_at", { ascending: false }),
        supabase
          .from("membership_cards")
          .select("id, card_number, year")
          .eq("participant_id", part.id)
          .order("year", { ascending: false }),
        supabase
          .from("medical_certificates")
          .select("id, expiry_date, ai_warning, disciplines, uploaded_at")
          .eq("participant_id", part.id)
          .order("uploaded_at", { ascending: false }),
      ]);

      setRegistrations((regsRes.data || []) as unknown as RegistrationRow[]);
      setCards(cardsRes.data || []);
      setCertificates(certsRes.data || []);
      setLoading(false);
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate("/area-riservata", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/area-riservata", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!participant) return null;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoDark} alt="GINEPRO" className="h-8 object-contain" />
            <span className="text-sm font-medium text-foreground hidden sm:block">Area Riservata</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {participant.nome} {participant.cognome}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Esci</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Tessere */}
        {cards.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Le mie tessere
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {cards.map((card) => (
                <Card key={card.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Tessera {card.year}</p>
                      <p className="font-mono text-lg font-bold text-foreground">{card.card_number}</p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/card/${card.id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Visualizza
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Dati anagrafici */}
        <section className="space-y-4">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Dati anagrafici
          </h2>
          <Card className="border-border/50">
            <CardContent className="p-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3">
                {participant.photo_thumb_url && (
                  <img
                    src={participant.photo_thumb_url}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover border border-border"
                  />
                )}
                <div>
                  <p className="font-semibold text-foreground">{participant.nome} {participant.cognome}</p>
                  <p className="text-sm text-muted-foreground">{participant.email}</p>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Telefono:</span> <span className="text-foreground">{participant.telefono}</span></p>
                {participant.codice_fiscale && (
                  <p><span className="text-muted-foreground">C.F.:</span> <span className="text-foreground font-mono">{participant.codice_fiscale}</span></p>
                )}
                {participant.birth_date && (
                  <p><span className="text-muted-foreground">Nato il:</span> <span className="text-foreground">{formatDate(participant.birth_date)}</span></p>
                )}
                {participant.birth_place && (
                  <p><span className="text-muted-foreground">Luogo:</span> <span className="text-foreground">{participant.birth_place}</span></p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Iscrizioni */}
        <section className="space-y-4">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Le mie iscrizioni
          </h2>
          {registrations.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-6 text-center text-muted-foreground">
                Nessuna iscrizione completata.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {registrations.map((reg) => (
                <Card key={reg.id} className="border-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {reg.events?.nome || "Evento"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {reg.events?.data_evento ? formatDate(reg.events.data_evento) : formatDate(reg.created_at)} · {reg.payment_method}
                      </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Confermata
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Certificati medici */}
        <section className="space-y-4">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Certificati medici
          </h2>
          {certificates.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="p-6 text-center text-muted-foreground">
                Nessun certificato caricato.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {certificates.map((cert) => (
                <Card key={cert.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Certificato medico
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Caricato il {formatDate(cert.uploaded_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        {cert.expiry_date && (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Scadenza: </span>
                            <span className={`font-medium ${new Date(cert.expiry_date) < new Date() ? "text-destructive" : "text-foreground"}`}>
                              {formatDate(cert.expiry_date)}
                            </span>
                          </p>
                        )}
                        {cert.disciplines && cert.disciplines.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {cert.disciplines.join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    {cert.ai_warning && (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
                        ⚠️ {cert.ai_warning}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default AreaRiservataDashboard;
