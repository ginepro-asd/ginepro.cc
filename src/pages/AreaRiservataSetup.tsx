import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, CheckCircle, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoDark from "@/assets/icon-mountain.png";

const AreaRiservataSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const participantId = searchParams.get("participant_id");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!participantId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <h1 className="text-xl font-bold text-foreground">Link non valido</h1>
            <p className="text-muted-foreground text-sm">
              Questo link di configurazione non è valido. Usa il link ricevuto via email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Le password non coincidono", variant: "destructive" });
      return;
    }

    if (password.length < 6) {
      toast({ title: "La password deve essere di almeno 6 caratteri", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("setup-account", {
        body: { participant_id: participantId, email, password },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Auto-login
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginErr) throw loginErr;

      setDone(true);
      setTimeout(() => navigate("/area-riservata"), 1500);
    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Si è verificato un errore",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="max-w-md w-full border-border/50 shadow-xl">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground mb-2">Account configurato!</h1>
              <p className="text-muted-foreground">Accesso in corso alla tua area riservata...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <Card className="max-w-md w-full border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <img src={logoDark} alt="GINEPRO" className="h-10 mx-auto object-contain" />
          <div>
            <CardTitle className="text-xl font-display">Configura il tuo account</CardTitle>
            <CardDescription className="mt-2">
              Scegli una password per accedere alla tua area riservata
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="La tua email di registrazione"
                required
              />
              <p className="text-xs text-muted-foreground">
                Inserisci la stessa email usata per il tesseramento
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caratteri"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Conferma password</Label>
              <Input
                id="confirm"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ripeti la password"
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Crea account
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AreaRiservataSetup;
