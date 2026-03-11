import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  value?: string | null;
}

const SignaturePad = ({ onSignatureChange, value }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<"draw" | "upload">("draw");

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx };
  }, []);

  useEffect(() => {
    const c = getCtx();
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.canvas.getBoundingClientRect();
    c.canvas.width = rect.width * dpr;
    c.canvas.height = rect.height * dpr;
    c.ctx.scale(dpr, dpr);
    c.ctx.lineWidth = 2;
    c.ctx.lineCap = "round";
    c.ctx.lineJoin = "round";
    c.ctx.strokeStyle = "hsl(var(--foreground))";
  }, [getCtx]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const c = getCtx();
    if (!c) return;
    const pos = getPos(e);
    c.ctx.beginPath();
    c.ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const c = getCtx();
    if (!c) return;
    const pos = getPos(e);
    c.ctx.lineTo(pos.x, pos.y);
    c.ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const c = getCtx();
    if (!c) return;
    const rect = c.canvas.getBoundingClientRect();
    c.ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      onSignatureChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "draw" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("draw")}
        >
          Disegna
        </Button>
        <Button
          type="button"
          variant={mode === "upload" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("upload")}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Carica
        </Button>
      </div>

      {mode === "draw" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-40 border border-border rounded-lg bg-background cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          {hasDrawn && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2"
              onClick={clear}
            >
              <Eraser className="h-4 w-4" />
            </Button>
          )}
          <p className="text-xs text-muted-foreground mt-1">Firma con il mouse o il dito</p>
        </div>
      ) : (
        <div>
          <Input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="cursor-pointer"
          />
          {value && (
            <img src={value} alt="Firma caricata" className="mt-2 h-24 border border-border rounded-lg p-2 bg-background" />
          )}
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
