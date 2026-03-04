import { Link, Navigate } from "react-router-dom";
import { useEvents, usePastEvents, formatPrice } from "@/hooks/use-event";
import { Loader2, Calendar, MapPin, Users, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoDark from "@/assets/icon-mountain.png";

const EventsList = () => {
  const { data: events, isLoading } = useEvents();
  const { data: pastEvents } = usePastEvents();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If only one active event and no past events, redirect directly
  if (events && events.length === 1 && (!pastEvents || pastEvents.length === 0)) {
    return <Navigate to={`/${events[0].slug}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <img src={logoDark} alt="GINEPRO" className="h-16 mx-auto mb-6 object-contain" />
          <h1 className="font-display text-4xl sm:text-5xl font-black text-foreground mb-2">Eventi</h1>
          <p className="text-muted-foreground">Scegli l'evento a cui vuoi iscriverti</p>
        </div>

        {(!events || events.length === 0) && (
          <p className="text-center text-muted-foreground">Nessun evento attivo al momento.</p>
        )}

        <div className="grid gap-4">
          {events?.map((event) => (
            <Link key={event.id} to={`/${event.slug}`}>
              <Card className="border-border/50 shadow-lg bg-card/80 backdrop-blur-sm hover:shadow-xl transition-shadow cursor-pointer">
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">{event.nome}</h2>
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      {event.data_evento && (
                        <span>
                          <Calendar className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                          {new Date(event.data_evento).toLocaleDateString("it-IT", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {event.luogo && (
                        <span>
                          <MapPin className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                          {event.luogo}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-display text-lg font-bold text-secondary">
                      {formatPrice(event.prezzo)}
                    </span>
                    <Button size="sm" className="mt-2 block">Iscriviti</Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Past events section */}
        {pastEvents && pastEvents.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-display text-2xl font-bold text-muted-foreground">Eventi passati</h2>
            </div>
            <div className="grid gap-3">
              {pastEvents.map((pe) => (
                <Card key={pe.id} className="border-border/30 bg-card/40 backdrop-blur-sm">
                  <CardContent className="p-5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-foreground/70">{pe.nome}</h3>
                        {pe.is_tesseramento && (
                          <Badge variant="secondary" className="text-xs">Tesseramento</Badge>
                        )}
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-muted-foreground/70">
                        {pe.data_evento && (
                          <span>
                            <Calendar className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                            {new Date(pe.data_evento).toLocaleDateString("it-IT", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {pe.luogo && (
                          <span>
                            <MapPin className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                            {pe.luogo}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span className="font-display text-lg font-bold">{pe.registration_count}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsList;
