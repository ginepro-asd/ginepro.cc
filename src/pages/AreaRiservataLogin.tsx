import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logoDark from "@/assets/icon-mountain.png";

const AreaRiservataLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/area-riservata/dashboard", { replace: true });
      }
      setCheckingSession(false);
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let email = identifier.trim();

      // If not an email, resolve via edge function
      if (!email.includes("@")) {
        const { data, error } = await supabase.functions.invoke("resolve-login", {
          body: { identifier: email },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        email = data.email;
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      });

      if (authErr) {
        if (authErr.message.includes("Invalid login credentials")) {
          throw new Error("Credenziali non valide. Controlla email/identificativo e password.");
        }
        throw authErr;
      }

      navigate("/area-riservata/dashboard", { replace: true });
    } catch (err: any) {
      toast({
        title: "Errore di accesso",
        description: err.message || "Si è verificato un errore",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <Card className="max-w-md w-full border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <img src={logoDark} alt="GINEPRO" className="h-10 mx-auto object-contain" />
          <div>
            <CardTitle className="text-xl font-display">Area Riservata</CardTitle>
            <CardDescription className="mt-2">
              Accedi con email, numero di telefono o numero tessera
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email, telefono o n° tessera</Label>
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="es. mario@email.com, 3331234567, 2026-001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="La tua password"
                  required
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Accedi
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AreaRiservataLogin;
