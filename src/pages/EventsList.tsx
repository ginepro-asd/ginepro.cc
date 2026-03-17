import ThemeSelector from "@/components/ThemeSelector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice, useEvents, usePastEvents } from "@/hooks/use-event";
import { getStartingPrice, hasVariablePricing } from "@/lib/event-pricing";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUpRight, CalendarDays, Clock3, Compass, Loader2, MapPin, Ticket, Users } from "lucide-react";
import { useTheme } from "next-themes";
import React from "react";
import { Link } from "react-router-dom";

const formatEventDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Data in arrivo";

const summarize = (text: string | null, fallback: string) => {
  if (!text) return fallback;

  return text.length > 150 ? `${text.slice(0, 147).trim()}...` : text;
};

const getLocationLabel = (event: { location_label?: string | null } | null | undefined) =>
  event?.location_label?.trim() || null;

const EventsList = () => {
  const { resolvedTheme } = useTheme();
  const { data: events, isLoading } = useEvents();
  const { data: pastEvents } = usePastEvents();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    document.title = "GINEPRO | Eventi e tesseramento";

    return () => {
      document.title = "Ginepro";
    };
  }, []);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeEvents = events || [];
  const tesseramentoEvent = activeEvents.find((event) => event.is_tesseramento) || null;
  const featuredEvent =
    activeEvents.find((event) => !event.is_tesseramento) || tesseramentoEvent || activeEvents[0] || null;
  const registrationHref = tesseramentoEvent
    ? `/${tesseramentoEvent.slug}`
    : featuredEvent
      ? `/${featuredEvent.slug}`
      : null;
  const archivedParticipants = (pastEvents || []).reduce((total, event) => total + event.registration_count, 0);
  const featuredLocation = getLocationLabel(featuredEvent);
  const featuredPrice = featuredEvent ? getStartingPrice(featuredEvent.prezzo, featuredEvent.custom_fields) : null;
  const featuredHasVariablePricing = featuredEvent ? hasVariablePricing(featuredEvent.custom_fields) : false;
  const isDarkTheme = mounted ? resolvedTheme !== "light" : true;
  const heroLogoSrc = isDarkTheme ? "/logos/ginepro-logo-chiaro-02.svg" : "/logos/ginepro-logo-chiaro-01.svg";
  const heroGlassClass = isDarkTheme ? "border border-white/15 bg-black/30" : "border border-white/70 bg-white/62";
  const heroTitleClass = isDarkTheme ? "text-white" : "text-[#08181b]";
  const heroMutedClass = isDarkTheme ? "text-white/72" : "text-[#08181b]/72";
  const heroSoftClass = isDarkTheme ? "text-white/55" : "text-[#08181b]/58";
  const heroChipClass = isDarkTheme
    ? "border border-white/12 bg-black/20 text-white/80"
    : "border border-black/10 bg-white/48 text-[#08181b]/82";
  const heroChipStrongClass = isDarkTheme ? "text-white" : "text-[#08181b]";
  const heroOutlineButtonClass = isDarkTheme
    ? "border-white/20 bg-black/20 text-white backdrop-blur-md hover:bg-white/10 hover:text-white"
    : "border-black/10 bg-white/52 text-[#08181b] backdrop-blur-md hover:bg-white/68 hover:text-[#08181b]";
  const heroAsideClass = isDarkTheme
    ? "border border-white/12 bg-white/10 text-white"
    : "border border-white/65 bg-white/38 text-[#08181b]";
  const heroInsetCardClass = isDarkTheme ? "border border-white/12 bg-black/18" : "border border-black/10 bg-white/48";
  const scrollToEvents = () => document.getElementById("eventi")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background">
      <section
        className={cn(
          "relative isolate min-h-[100svh] overflow-hidden",
          isDarkTheme ? "bg-[#06161a] text-white" : "bg-[#dfe7e5] text-[#08181b]",
        )}
      >
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/videos-ginepro-hero-poster.jpg"
        >
          <source src="/videos-ginepro-hero.mp4" type="video/mp4" />
        </video>

        <div className={cn("absolute inset-0", isDarkTheme ? "bg-black/35" : "bg-white/54")} />
        <div
          className={cn(
            "absolute inset-0",
            isDarkTheme
              ? "bg-[radial-gradient(circle_at_15%_20%,rgba(250,117,152,0.28),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(3,92,103,0.34),transparent_28%),linear-gradient(180deg,rgba(6,22,26,0.10)_0%,rgba(6,22,26,0.52)_55%,rgba(6,22,26,0.85)_78%,rgba(244,246,246,1)_100%)]"
              : "bg-[radial-gradient(circle_at_15%_20%,rgba(250,117,152,0.18),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.74),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.46)_55%,rgba(244,246,246,0.82)_78%,rgba(244,246,246,1)_100%)]",
          )}
        />
        <div className={cn("hero-grid absolute inset-0", isDarkTheme ? "opacity-20" : "opacity-10")} />
        <div
          className={cn(
            "animate-hero-float absolute -left-16 top-24 h-72 w-72 rounded-full blur-3xl",
            isDarkTheme ? "bg-white/10" : "bg-white/65",
          )}
        />
        <div className="animate-hero-float-delayed absolute bottom-10 right-[-5rem] h-80 w-80 rounded-full bg-secondary/20 blur-3xl" />
        <div
          className={cn(
            "animate-hero-pulse absolute right-[12%] top-[18%] h-28 w-28 rounded-full border",
            isDarkTheme ? "border-white/15" : "border-black/10",
          )}
        />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-b from-transparent to-background" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-start justify-between gap-4">
            <div
              className={cn(
                "rounded-[26px] px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors",
                heroGlassClass,
              )}
            >
              <img src={heroLogoSrc} alt="GINEPRO" className="h-10 w-auto object-contain sm:h-12" />
            </div>

            <ThemeSelector inverted={isDarkTheme} className="shrink-0" />
          </header>

          <div className="grid flex-1 items-end gap-12 pb-10 pt-12 lg:grid-cols-[minmax(0,1.08fr)_380px] lg:pb-16">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl"
            >
              <h1
                className={cn(
                  "text-balance font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl",
                  heroTitleClass,
                )}
              >
                Benvenuto in GINEPRO
              </h1>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {registrationHref ? (
                  <Button
                    asChild
                    size="lg"
                    className="h-14 rounded-full bg-white px-8 text-base font-semibold text-[#08262a] shadow-[0_20px_60px_rgba(0,0,0,0.28)] hover:bg-white/90"
                  >
                    <Link to={registrationHref}>
                      Tesserati con GINEPRO
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="h-14 rounded-full bg-white px-8 text-base font-semibold text-[#08262a] shadow-[0_20px_60px_rgba(0,0,0,0.28)] hover:bg-white/90"
                    onClick={scrollToEvents}
                  >
                    Tesserati con GINEPRO
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  size="lg"
                  variant="outline"
                  onClick={scrollToEvents}
                  className={cn("h-14 rounded-full px-8 text-base", heroOutlineButtonClass)}
                >
                  Vedi tutti gli eventi
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <div className={cn("rounded-full px-4 py-2 text-sm backdrop-blur-md", heroChipClass)}>
                  <span className={cn("font-semibold", heroChipStrongClass)}>{activeEvents.length}</span> eventi aperti
                </div>
                {featuredLocation && (
                  <div className={cn("rounded-full px-4 py-2 text-sm backdrop-blur-md", heroChipClass)}>
                    Prossima tappa: <span className={cn("font-semibold", heroChipStrongClass)}>{featuredLocation}</span>
                  </div>
                )}
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15 }}
              className={cn(
                "relative overflow-hidden rounded-[32px] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl",
                heroAsideClass,
              )}
            >
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-secondary/25 blur-3xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={cn("text-xs uppercase tracking-[0.28em]", heroSoftClass)}>live now</p>
                    <h2 className="mt-3 font-display text-3xl font-bold">Stagione GINEPRO</h2>
                  </div>
                  <Ticket className={cn("mt-1 h-5 w-5", heroMutedClass)} />
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <div className={cn("rounded-[24px] p-4 backdrop-blur-md", heroInsetCardClass)}>
                      <div className={cn("flex items-center gap-2", heroSoftClass)}>
                        <Compass className="h-4 w-4" />
                        <span className="text-xs uppercase tracking-[0.22em]">Eventi attivi</span>
                      </div>
                      <p className="mt-3 font-display text-3xl font-bold">{activeEvents.length}</p>
                    </div>
                  </div>

                  {featuredEvent && (
                    <div className={cn("rounded-[24px] p-5 backdrop-blur-md", heroInsetCardClass)}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={cn("text-xs uppercase tracking-[0.24em]", heroSoftClass)}>Prossimo evento</p>
                          <p className="mt-2 font-display text-xl font-semibold">{featuredEvent.nome}</p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs",
                            isDarkTheme
                              ? "border border-white/15 bg-black/20 text-white/70"
                              : "border border-black/10 bg-white/65 text-[#08181b]/72",
                          )}
                        >
                          {featuredHasVariablePricing && featuredPrice !== null
                            ? `da ${formatPrice(featuredPrice)}`
                            : formatPrice(featuredPrice || 0)}
                        </span>
                      </div>

                      <div className={cn("mt-4 flex flex-wrap gap-4 text-sm", heroMutedClass)}>
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          {formatEventDate(featuredEvent.data_evento)}
                        </span>
                        {featuredLocation && (
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            {featuredLocation}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>

      <section id="eventi" className="scroll-mt-24 px-4 pb-24 pt-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.24em] text-primary/70">Sezione eventi</p>
              <h2 className="mt-3 font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                Tutto quello che bolle in pentola.
              </h2>
            </div>

            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Un breve sguardo alle nostre prossime avventure, con tutte le informazioni essenziali per partecipare e
              vivere l'esperienza GINEPRO al massimo.
            </p>
          </div>

          {activeEvents.length === 0 ? (
            <Card className="mt-10 overflow-hidden rounded-[32px] border-border/60 bg-card/80 shadow-xl">
              <CardContent className="p-8 sm:p-10">
                <p className="font-display text-2xl font-bold text-foreground">Nessun evento attivo al momento.</p>
                <p className="mt-3 max-w-xl text-muted-foreground">
                  Resta sintonizzato! Stiamo preparando nuove esperienze che saranno presto disponibili. Nel frattempo,
                  puoi esplorare il nostro archivio di eventi passati o iscriverti alla newsletter per ricevere
                  aggiornamenti in tempo reale.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {activeEvents.map((event, index) => {
                const hasHeroImage = Boolean(event.hero_image);
                const eventLocation = getLocationLabel(event);
                const eventPrice = getStartingPrice(event.prezzo, event.custom_fields);
                const eventHasVariablePricing = hasVariablePricing(event.custom_fields);

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.55, delay: index * 0.08 }}
                  >
                    <Link to={`/${event.slug}`} className="group block h-full">
                      <article
                        className={cn(
                          "relative flex h-full flex-col overflow-hidden rounded-[32px] border shadow-[0_18px_45px_rgba(3,22,25,0.08)] transition-transform duration-300 group-hover:-translate-y-1",
                          event.is_tesseramento ? "border-secondary/50 bg-card" : "border-border/70 bg-card",
                        )}
                      >
                        {hasHeroImage ? (
                          <>
                            <img
                              src={event.hero_image || undefined}
                              alt={event.nome}
                              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/25 to-background/95 dark:to-background/90" />
                          </>
                        ) : (
                          <div
                            className={cn(
                              "absolute inset-0",
                              event.is_tesseramento
                                ? "bg-[radial-gradient(circle_at_top_left,rgba(250,117,152,0.24),transparent_30%),linear-gradient(135deg,rgba(12,61,66,0.96),rgba(3,92,103,0.85))]"
                                : "bg-[radial-gradient(circle_at_top_left,rgba(3,92,103,0.15),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.92),rgba(232,241,241,0.95))] dark:bg-[radial-gradient(circle_at_top_left,rgba(250,117,152,0.18),transparent_25%),linear-gradient(135deg,rgba(8,22,25,0.96),rgba(10,40,44,0.94))]",
                            )}
                          />
                        )}

                        <div className="relative flex h-full flex-col justify-between gap-8 p-6 sm:p-8">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant={event.is_tesseramento ? "secondary" : "outline"}
                              className={cn(
                                "rounded-full px-3 py-1 text-xs",
                                event.is_tesseramento
                                  ? "border-transparent"
                                  : hasHeroImage
                                    ? "border-white/15 bg-black/18 text-white"
                                    : "border-border/80 bg-background/80 text-foreground",
                              )}
                            >
                              {event.is_tesseramento ? "Tesseramento" : "Evento attivo"}
                            </Badge>
                            <span
                              className={cn(
                                "rounded-full px-3 py-1 text-xs backdrop-blur-md",
                                hasHeroImage || event.is_tesseramento
                                  ? "border border-white/12 bg-black/18 text-white/80"
                                  : "border border-border/70 bg-background/70 text-muted-foreground",
                              )}
                            >
                              {formatEventDate(event.data_evento)}
                            </span>
                          </div>

                          <div className="max-w-xl">
                            <h3
                              className={cn(
                                "font-display text-3xl font-bold tracking-tight sm:text-[2.1rem]",
                                hasHeroImage || event.is_tesseramento ? "text-white" : "text-foreground",
                              )}
                            >
                              {event.nome}
                            </h3>
                            <p
                              className={cn(
                                "mt-3 text-sm leading-6 sm:text-base",
                                hasHeroImage || event.is_tesseramento ? "text-white/80" : "text-muted-foreground",
                              )}
                            >
                              {summarize(
                                event.descrizione,
                                event.is_tesseramento
                                  ? "Accesso al club, identita GINEPRO e vantaggi per tutta la stagione."
                                  : "Scheda evento con iscrizione, dettagli logistici e informazioni aggiornate.",
                              )}
                            </p>
                          </div>

                          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div
                              className={cn(
                                "flex flex-wrap gap-4 text-sm",
                                hasHeroImage || event.is_tesseramento ? "text-white/75" : "text-muted-foreground",
                              )}
                            >
                              {eventLocation && (
                                <span className="inline-flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  {eventLocation}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-2">
                                <CalendarDays className="h-4 w-4" />
                                {formatEventDate(event.data_evento)}
                              </span>
                            </div>

                            <div className="flex items-end gap-4">
                              <div className="text-right">
                                {eventPrice ? (
                                  <>
                                    <p
                                      className={cn(
                                        "text-xs uppercase tracking-[0.24em]",
                                        hasHeroImage || event.is_tesseramento
                                          ? "text-white/55"
                                          : "text-muted-foreground/70",
                                      )}
                                    >
                                      Quota da
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-2 font-display text-3xl font-bold",
                                        hasHeroImage || event.is_tesseramento ? "text-white" : "text-foreground",
                                      )}
                                    >
                                      {eventHasVariablePricing
                                        ? `da ${formatPrice(eventPrice)}`
                                        : formatPrice(eventPrice)}
                                    </p>
                                  </>
                                ) : undefined}
                              </div>

                              <span
                                className={cn(
                                  "inline-flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-transform duration-300 group-hover:translate-x-1",
                                  hasHeroImage || event.is_tesseramento
                                    ? "bg-white text-[#08262a]"
                                    : "bg-primary text-primary-foreground",
                                )}
                              >
                                {event.is_tesseramento ? "Apri tesseramento" : "Apri evento"}
                                <ArrowUpRight className="h-4 w-4" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {pastEvents && pastEvents.length > 0 && (
        <section className="border-t border-border/60 px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-display text-2xl font-bold text-foreground">Archivio recente</h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pastEvents.map((event) => (
                <Card
                  key={event.id}
                  className="rounded-[28px] border-border/60 bg-card/70 shadow-[0_18px_40px_rgba(3,22,25,0.06)] backdrop-blur-sm"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-semibold text-foreground">{event.nome}</h3>
                          {event.is_tesseramento && (
                            <Badge variant="secondary" className="rounded-full">
                              Tesseramento
                            </Badge>
                          )}
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                          <p className="inline-flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            {formatEventDate(event.data_evento)}
                          </p>
                          {getLocationLabel(event) && (
                            <p className="inline-flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {getLocationLabel(event)}
                            </p>
                          )}
                        </div>
                      </div>

                      {event.registration_count > 0 && (
                        <div className="rounded-2xl bg-muted px-4 py-3 text-center">
                          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Iscritti</p>
                          <p className="mt-2 font-display text-2xl font-bold text-foreground">
                            {event.registration_count}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default EventsList;
