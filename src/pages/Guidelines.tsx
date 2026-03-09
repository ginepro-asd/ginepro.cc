import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { jsPDF } from "jspdf";

const LOGOS = [
  {
    id: "scuro",
    label: "Logo Scuro",
    description: "Per sfondi bianchi o molto chiari",
    file: "/logos/ginepro-logo-chiaro-01.svg",
    bgClass: "bg-white",
    textClass: "text-foreground",
    borderClass: "border border-border",
  },
  {
    id: "chiaro",
    label: "Logo Chiaro",
    description: "Per sfondi neri o molto scuri",
    file: "/logos/ginepro-logo-chiaro-02.svg",
    bgClass: "bg-[#0a1a1c]",
    textClass: "text-white",
    borderClass: "",
  },
  {
    id: "bianco",
    label: "Logo Bianco",
    description: "Per sfondi colorati scuri con alto contrasto",
    file: "/logos/ginepro-logo-bianco.svg",
    bgClass: "bg-teal-dark",
    textClass: "text-white",
    borderClass: "",
  },
  {
    id: "nero",
    label: "Logo Nero",
    description: "Per sfondi colorati chiari con alto contrasto",
    file: "/logos/ginepro-logo-nero.svg",
    bgClass: "bg-coral-light",
    textClass: "text-foreground",
    borderClass: "",
  },
];

const downloadSvg = (file: string, name: string) => {
  const a = document.createElement("a");
  a.href = file;
  a.download = `${name}.svg`;
  a.click();
};

const downloadPdf = async (file: string, name: string) => {
  const img = new Image();
  img.crossOrigin = "anonymous";

  const svgResp = await fetch(file);
  const svgText = await svgResp.text();
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise<void>((resolve) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 4;
      canvas.width = img.naturalWidth * scale;
      canvas.height = img.naturalHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: img.naturalWidth > img.naturalHeight ? "landscape" : "portrait",
        unit: "px",
        format: [img.naturalWidth * scale, img.naturalHeight * scale],
      });
      pdf.addImage(imgData, "PNG", 0, 0, img.naturalWidth * scale, img.naturalHeight * scale);
      pdf.save(`${name}.pdf`);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.src = url;
  });
};

const Guidelines = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handlePdfDownload = async (file: string, name: string) => {
    setDownloading(name);
    try {
      await downloadPdf(file, name);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container max-w-5xl mx-auto py-6 px-4 flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Brand Guidelines</h1>
            <p className="text-muted-foreground mt-1">Guida all'utilizzo del logo Ginepro</p>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl mx-auto py-10 px-4 space-y-14">
        {/* Font Section */}
        <section>
          <h2 className="text-2xl font-display font-bold text-foreground mb-3">Tipografia</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            Il font consigliato per tutte le grafiche Ginepro è <strong className="text-foreground">Outfit</strong> per i titoli 
            e <strong className="text-foreground">Space Grotesk</strong> per i testi, gli stessi utilizzati su questo sito.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Display / Titoli</p>
                <p className="font-display text-4xl font-bold text-foreground">Outfit</p>
                <p className="font-display text-lg text-muted-foreground mt-2">
                  AaBbCcDdEeFf 0123456789
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Body / Testi</p>
                <p className="font-body text-4xl font-bold text-foreground">Space Grotesk</p>
                <p className="font-body text-lg text-muted-foreground mt-2">
                  AaBbCcDdEeFf 0123456789
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Color Palette */}
        <section>
          <h2 className="text-2xl font-display font-bold text-foreground mb-3">Palette Colori</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            I colori primari del brand Ginepro.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { name: "Teal Scuro", hex: "#035C67", cls: "bg-teal" },
              { name: "Teal Dark", hex: "#0C3D42", cls: "bg-teal-dark" },
              { name: "Corallo", hex: "#FA7598", cls: "bg-coral" },
              { name: "Corallo Chiaro", hex: "#FDB5C7", cls: "bg-coral-light" },
            ].map((c) => (
              <div key={c.name} className="flex flex-col items-center gap-2">
                <div className={`${c.cls} w-full aspect-square rounded-lg shadow-sm`} />
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{c.hex}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Logo Usage Rules */}
        <section>
          <h2 className="text-2xl font-display font-bold text-foreground mb-3">Utilizzo del Logo</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            Scegli la versione del logo in base allo sfondo su cui verrà posizionato, garantendo sempre la massima leggibilità.
          </p>

          <div className="grid sm:grid-cols-2 gap-6">
            {LOGOS.map((logo) => (
              <Card key={logo.id} className="overflow-hidden">
                <div className={`${logo.bgClass} ${logo.borderClass} flex items-center justify-center p-10 min-h-[200px]`}>
                  <img
                    src={logo.file}
                    alt={`Logo Ginepro - ${logo.label}`}
                    className="max-h-28 w-auto object-contain"
                  />
                </div>
                <CardContent className="p-5 space-y-3">
                  <div>
                    <h3 className="font-display font-semibold text-lg text-foreground">{logo.label}</h3>
                    <p className="text-sm text-muted-foreground">{logo.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadSvg(logo.file, `ginepro-${logo.id}`)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      SVG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={downloading === `ginepro-${logo.id}`}
                      onClick={() => handlePdfDownload(logo.file, `ginepro-${logo.id}`)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      {downloading === `ginepro-${logo.id}` ? "..." : "PDF"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Rules Summary */}
        <section>
          <h2 className="text-2xl font-display font-bold text-foreground mb-3">Regole Rapide</h2>
          <div className="grid gap-4 max-w-2xl">
            {[
              { rule: "Sfondo bianco o molto chiaro", action: "Usa il Logo Scuro (teal + corallo)" },
              { rule: "Sfondo nero o molto scuro", action: "Usa il Logo Chiaro (teal chiaro + corallo)" },
              { rule: "Sfondo colorato scuro", action: "Usa il Logo Bianco" },
              { rule: "Sfondo colorato chiaro", action: "Usa il Logo Nero" },
            ].map((r, i) => (
              <div key={i} className="flex gap-4 items-start p-4 bg-card rounded-lg border border-border">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{r.rule}</p>
                  <p className="text-sm text-muted-foreground">→ {r.action}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-6 max-w-2xl">
            In ogni caso, la priorità è sempre la <strong className="text-foreground">leggibilità</strong> e il <strong className="text-foreground">contrasto</strong> del logo rispetto allo sfondo.
          </p>
        </section>
      </main>
    </div>
  );
};

export default Guidelines;
