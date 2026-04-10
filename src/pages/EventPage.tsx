import React, { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDown, MapPin, Calendar, Mountain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import Countdown from "@/components/Countdown";
import RegistrationForm from "@/components/RegistrationForm";
import PairRegistrationForm from "@/components/PairRegistrationForm";
import TesseramentoForm from "@/components/TesseramentoForm";
import TopographicPattern from "@/components/TopographicPattern";
import logoDark from "@/assets/icon-mountain.png";
import { useEvent, formatPrice } from "@/hooks/use-event";
import { supabase } from "@/integrations/supabase/client";
import {
  getStartingPrice,
  hasVariablePricing,
  getRouteSelectionField,
  isOptionCoppia,
  hasCoppiaOptions,
  getOptionPrice,
  getOptionMaxSpots,
  hasMaxSpotsOptions,
  isOptionFeatured,
} from "@/lib/event-pricing";
import { useQuery } from "@tanstack/react-query";

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: event, isLoading, error } = useEvent(slug);
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("");

  React.useEffect(() => {
    if (event) {
      document.title = `Ginepro - ${event.nome}`;
    }
    return () => {
      document.title = "Ginepro";
    };
  }, [event?.nome]);

  const routeField = event ? getRouteSelectionField(event.custom_fields) : null;
  const showMaxSpots = event ? hasMaxSpotsOptions(event.custom_fields) : false;
  const showDisciplineSelectorForSpots = showMaxSpots && routeField && !hasCoppiaOptions(event!.custom_fields);

  // Fetch spot counts for options with max_spots
  const { data: spotCounts } = useQuery({
    queryKey: ["spot-counts", event?.id],
    queryFn: async () => {
      if (!event || !routeField) return {};
      const { data: regs } = await supabase
        .from("registrations")
        .select("custom_data")
        .eq("event_id", event.id)
        .eq("payment_status", "completed");

      const counts: Record<string, number> = {};
      if (regs) {
        for (const r of regs) {
          const disc = (r.custom_data as any)?.[routeField.key];
          if (disc) counts[disc] = (counts[disc] || 0) + 1;
        }
      }
      return counts;
    },
    enabled: !!event && showMaxSpots,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (routeField?.options?.length && !selectedDiscipline) {
      setSelectedDiscipline(routeField.options[0]);
    }
  }, [routeField?.options?.join("|")]);

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

  const hasMixedCoppia =
    hasCoppiaOptions(event.custom_fields) && routeField?.options?.some((o) => !isOptionCoppia(routeField, o));
  const allCoppia = event.is_coppia && !hasMixedCoppia;
  const isCoppiaForSelected = allCoppia || (hasMixedCoppia && isOptionCoppia(routeField, selectedDiscipline));
  const showDisciplineSelector =
    routeField && (hasMixedCoppia || showDisciplineSelectorForSpots || hasVariablePricing(event!.custom_fields));

  // Split event name for styled display
  const nameParts = event.nome.split(" ");
  const firstWord = nameParts[0];
  const restWords = nameParts.slice(1).join(" ");

  const getRemainingSpots = (option: string): number | null => {
    const maxSpots = getOptionMaxSpots(routeField, option);
    if (maxSpots === null) return null;
    const used = spotCounts?.[option] || 0;
    return Math.max(0, maxSpots - used);
  };

  const isOptionSoldOut = (option: string): boolean => {
    const remaining = getRemainingSpots(option);
    return remaining !== null && remaining <= 0;
  };

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
            className="mb-8 flex flex-col"
          >
            {startingPrice > 0 ? (
              <div className="bg-secondary/15 border border-secondary/30 rounded-full px-6 py-2.5">
                <span className="font-display text-2xl sm:text-3xl font-bold text-secondary">
                  {variablePricing ? `da ${formatPrice(startingPrice)}` : formatPrice(startingPrice)}
                </span>
                {(event.is_coppia || hasMixedCoppia) && (
                  <span className="text-sm text-secondary/70 ml-1">/ partecipante</span>
                )}
              </div>
            ) : undefined}
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
      {!event.is_tesseramento && (event.descrizione || event.regulation_url) && (
        <section className="relative py-16 sm:py-24 px-4 bg-muted/30">
          <div className="max-w-3xl mx-auto text-center">
            <Mountain className="h-10 w-10 mx-auto mb-6 text-primary" />
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6 text-foreground">L'evento</h2>
            {event.descrizione && (
              <p className="text-muted-foreground text-lg leading-relaxed mb-6 max-w-2xl mx-auto whitespace-pre-line">
                {event.descrizione}
              </p>
            )}
            {event.regulation_url && (
              <div className="mb-6">
                <a
                  href={event.regulation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                >
                  📄 Consulta il regolamento
                </a>
              </div>
            )}
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
      <span id="iscrizione" />

      {/* Registration Form or External Link */}
      {event.external_url ? (
        <section className="relative py-16 sm:py-24 px-4">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4 text-foreground">Iscrizione</h2>
            <p className="text-muted-foreground mb-8">
              Le iscrizioni per questo evento sono gestite su una piattaforma esterna.
            </p>
            <Button
              size="lg"
              className="font-display font-semibold text-lg px-10 h-13 shadow-lg hover:shadow-xl transition-shadow"
              asChild
            >
              <a href={event.external_url} target="_blank" rel="noopener noreferrer">
                Iscriviti su IDchronos
                <ArrowDown className="ml-2 h-4 w-4 rotate-[-135deg]" />
              </a>
            </Button>
          </div>
        </section>
      ) : event.is_tesseramento ? (
        <TesseramentoForm event={event} />
      ) : (
        <>
          {/* Discipline selector */}
          {showDisciplineSelector && routeField && (
            <section className="py-8 px-4">
              <div className="max-w-xl mx-auto">
                <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
                  <CardContent className="pt-6 space-y-3">
                    <Label className="text-sm font-medium">{routeField.label} *</Label>
                    <RadioGroup
                      value={selectedDiscipline}
                      onValueChange={(v) => {
                        if (!isOptionSoldOut(v)) setSelectedDiscipline(v);
                      }}
                      className="grid grid-cols-1 gap-3"
                    >
                      {routeField.options.map((opt) => {
                        const price = getOptionPrice(routeField, opt);
                        const coppia = isOptionCoppia(routeField, opt);
                        const remaining = getRemainingSpots(opt);
                        const soldOut = isOptionSoldOut(opt);
                        const featured = isOptionFeatured(routeField, opt);
                        return (
                          <label
                            key={opt}
                            htmlFor={`disc-ev-${opt}`}
                            className={`relative flex items-center gap-3 border rounded-lg p-4 transition-all ${
                              soldOut
                                ? "border-border/30 bg-muted/30 cursor-not-allowed opacity-60"
                                : featured
                                  ? `cursor-pointer featured-option ${selectedDiscipline === opt ? "featured-option-selected" : ""}`
                                  : selectedDiscipline === opt
                                    ? "border-primary bg-primary/5 shadow-sm cursor-pointer"
                                    : "border-border hover:border-primary/40 cursor-pointer"
                            }`}
                          >
                            <RadioGroupItem value={opt} id={`disc-ev-${opt}`} disabled={soldOut} />
                            <div className="flex-1">
                              <span className="text-sm font-medium">{opt}</span>
                              {coppia && <span className="ml-1.5 text-xs text-secondary font-medium">(in coppia)</span>}
                              {price !== null && (
                                <span className="block text-xs text-muted-foreground">
                                  {formatPrice(price)}
                                  {coppia ? " a partecipante" : ""}
                                </span>
                              )}
                            </div>
                            {remaining !== null && (
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  soldOut
                                    ? "bg-destructive/10 text-destructive"
                                    : remaining <= 5
                                      ? "bg-orange-500/10 text-orange-600"
                                      : "bg-green-500/10 text-green-600"
                                }`}
                              >
                                {soldOut ? "Esaurito" : `${remaining} posti`}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </RadioGroup>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}
          {isCoppiaForSelected ? (
            <PairRegistrationForm
              event={event}
              preselectedDiscipline={showDisciplineSelector ? selectedDiscipline : undefined}
            />
          ) : (
            <RegistrationForm
              event={event}
              preselectedDiscipline={showDisciplineSelector ? selectedDiscipline : undefined}
              spotCounts={spotCounts}
            />
          )}
        </>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border/50 text-center">
        <p className="text-sm text-muted-foreground">
          © 2025{" "}
          <a
            href="https://ginepro.cc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            GINEPRO
          </a>{" "}
          — {event.nome} ·{" "}
          <Link
            to={`/${slug}/admin`}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            ⚙
          </Link>
        </p>
      </footer>
    </div>
  );
};

export default EventPage;
