import { motion } from "framer-motion";
import { ArrowDown, MapPin, Calendar, Mountain } from "lucide-react";
import { Button } from "@/components/ui/button";
import Countdown from "@/components/Countdown";
import RegistrationForm from "@/components/RegistrationForm";
import TopographicPattern from "@/components/TopographicPattern";
import logoDark from "@/assets/icon-mountain.png";

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20">
        {/* Topographic background */}
        <TopographicPattern className="absolute inset-0 w-full h-full text-primary pointer-events-none" />

        {/* Decorative shapes */}
        <div className="absolute top-20 left-10 w-24 h-24 border border-secondary/20 rotate-45 hidden sm:block" />
        <div className="absolute bottom-32 right-16 w-16 h-16 rounded-full border border-primary/15 hidden sm:block" />
        <div className="absolute top-1/3 right-10 w-8 h-8 bg-secondary/10 rotate-12 hidden sm:block" />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-3xl"
        >
          {/* Logo */}
          <img src={logoDark} alt="GINEPRO" className="h-16 sm:h-20 mx-auto mb-8 object-contain" />

          {/* Title */}
          <h1 className="font-display text-5xl sm:text-7xl lg:text-8xl font-black tracking-tight text-foreground mb-3">
            Tredozio
            <span className="block text-secondary">Trail</span>
          </h1>

          <p className="font-display text-lg sm:text-xl text-muted-foreground mb-2 font-medium tracking-wide">
            <Calendar className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            11 Aprile 2027
          </p>
          <p className="font-display text-sm text-muted-foreground mb-8">
            <MapPin className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            Tredozio, Forlì-Cesena
          </p>

          {/* Price badge */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="inline-block mb-8"
          >
            <div className="bg-secondary/15 border border-secondary/30 rounded-full px-6 py-2.5">
              <span className="font-display text-2xl sm:text-3xl font-bold text-secondary">14,99€</span>
              <span className="text-muted-foreground ml-2 text-sm">Early-Bird</span>
            </div>
          </motion.div>

          {/* Countdown */}
          <div className="mb-10">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest">L'offerta scade tra</p>
            <Countdown />
          </div>

          {/* CTA */}
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
      <section className="relative py-16 sm:py-24 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <Mountain className="h-10 w-10 mx-auto mb-6 text-primary" />
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-6 text-foreground">L'evento</h2>
          <p className="text-muted-foreground text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            Il <strong className="text-foreground">Tredozio Trail</strong> è una gara di trail running che si snoda tra
            i sentieri e le colline dell'Appennino romagnolo, nel cuore della natura incontaminata di Tredozio.
            Organizzato da{" "}
            <a
              href="https://ginepro.cc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-medium"
            >
              GINEPRO
            </a>
            .
          </p>
          <div className="inline-block bg-secondary/10 border border-secondary/25 rounded-lg px-5 py-3">
            <p className="text-sm font-medium text-secondary">
              ⏰ Offerta early-bird valida fino al <strong>29 Marzo 2026 alle 23:59</strong>
            </p>
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <RegistrationForm />

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
          — Tredozio Trail
        </p>
      </footer>
    </div>
  );
};

export default Index;
