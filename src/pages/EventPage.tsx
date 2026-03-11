import React from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDown, MapPin, Calendar, Mountain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Countdown from "@/components/Countdown";
import RegistrationForm from "@/components/RegistrationForm";
import PairRegistrationForm from "@/components/PairRegistrationForm";
import TopographicPattern from "@/components/TopographicPattern";
import logoDark from "@/assets/icon-mountain.png";
import { useEvent, formatPrice } from "@/hooks/use-event";
import { getStartingPrice, hasVariablePricing } from "@/lib/event-pricing";

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: event, isLoading, error } = useEvent(slug);

  React.useEffect(() => {
    if (event) {
      document.title = `Ginepro - ${event.nome}`;
    }
    return () => { document.title = "Ginepro"; };
  }, [event?.nome]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !event) {
    return <Navigate to="/" replace />;
  }

  const eventDate = event.data_evento
    ? new Date(event.data_evento).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const variablePricing = hasVariablePricing(event.custom_fields);
  const startingPrice = getStartingPrice(event.prezzo, event.custom_fields);

  // Split event name for styled display
  const nameParts = event.nome.split(" ");
  const firstWord = nameParts[0];
  const restWords = nameParts.slice(1).join(" ");

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20">
        {event.hero_image ? (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${event.hero_image})` }}
            />
            <div className="absolute inset-0 bg-background/75 backdrop-blur-[2px]" />
          </>
        ) : (
          <TopographicPattern className="absolute inset-0 w-full h-full text-primary pointer-events-none" />
        )}

        <div className="absolute top-20 left-10 w-24 h-24 border border-secondary/20 rotate-45 hidden sm:block" />
        <div className="absolute bottom-32 right-16 w-16 h-16 rounded-full border border-primary/15 hidden sm:block" />
        <div className="absolute top-1/3 right-10 w-8 h-8 bg-secondary/10 rotate-12 hidden sm:block" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-3xl"
        >
          <img src={logoDark} alt="GINEPRO" className="h-16 sm:h-20 mx-auto mb-8 object-contain" />

          <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-foreground mb-3">
            {firstWord}
            {restWords && <span className="block text-secondary">{restWords}</span>}
          </h1>

          {eventDate && (
            <p className="font-display text-lg sm:text-xl text-muted-foreground mb-2 font-medium tracking-wide">
              <Calendar className="inline h-4 w-4 mr-1.5 -mt-0.5" />
              {eventDate}
            </p>
          )}
          {event.location_label && (
            <p className="font-display text-sm text-muted-foreground mb-8">
              <MapPin className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
              {event.location_lat && event.location_lng ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${event.location_lat},${event.location_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-primary"
                >
                  {event.location_label}
                </a>
              ) : (
                <span>{event.location_label}</span>
              )}
            </p>
          )}

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="inline-block mb-8 flex flex-col"
          >
            <div className="bg-secondary/15 border border-secondary/30 rounded-full px-6 py-2.5">
              <span className="font-display text-2xl sm:text-3xl font-bold text-secondary">
                {variablePricing ? `da ${formatPrice(startingPrice)}` : formatPrice(startingPrice)}
              </span>
              {event.is_coppia && (
                <span className="text-sm text-secondary/70 ml-1">/ partecipante</span>
              )}
            </div>
          </motion.div>

          {event.scadenza_iscrizioni && (
            <div className="mb-10 flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">Iscrizioni entro</p>
              <Countdown deadline={new Date(event.scadenza_iscrizioni)} />
            </div>
          )}

          <Button
            size="lg"
            className="font-display font-semibold text-lg px-10 h-13 shadow-lg hover:shadow-xl transition-shadow"
            onClick={() => document.getElementById("iscrizione")?.scrollIntoView({ behavior: "smooth" })}
          >
            Iscriviti ora
            <ArrowDown className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </section>

      {/* Info Section */}
      {event.descrizione && (
        <section className="relative py-16 sm:py-24 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <Mountain className="h-10 w-10 mx-auto mb-6 text-primary" />
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6 text-foreground">L'evento</h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
              {event.descrizione}
            </p>
            {event.scadenza_iscrizioni && (
              <div className="inline-block bg-secondary/10 border border-secondary/25 rounded-lg px-5 py-3">
                <p className="text-sm font-medium text-secondary">
                  ⏰ Offerta early-bird valida fino al{" "}
                  <strong>
                    {new Date(event.scadenza_iscrizioni).toLocaleDateString("it-IT", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Registration Form */}
      {event.is_coppia ? (
        <PairRegistrationForm event={event} />
      ) : (
        <RegistrationForm event={event} />
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50 text-center">
        <p className="text-sm text-muted-foreground">
          © 2025{" "}
          <a href="https://ginepro.cc" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            GINEPRO
          </a>{" "}
          — {event.nome} ·{" "}
          <Link to={`/${slug}/admin`} className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
            ⚙
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default EventPage;
