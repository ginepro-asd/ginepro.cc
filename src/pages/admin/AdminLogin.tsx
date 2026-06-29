import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/use-admin-auth";

const LOCAL_ADMIN_EMAIL = "domenico.diiorio@ginepro.cc";
const localSupabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const isLocalSupabase =
  import.meta.env.DEV &&
  /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(localSupabaseUrl);

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [localEmail, setLocalEmail] = useState(LOCAL_ADMIN_EMAIL);
  const [localPassword, setLocalPassword] = useState("");
  const { isAdmin, loading: authLoading, session } = useAdminAuth();
  const { toast } = useToast();

  useEffect(() => { document.title = "GINEPRO Admin — Login"; }, []);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      const target = (location.state as any)?.from || "/admin";
      navigate(target, { replace: true });
    }
  }, [authLoading, isAdmin, navigate, location.state]);

  const signInGoogle = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/admin`,
      });
      if (result.error) throw result.error;
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const signInLocal = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: localEmail.trim().toLowerCase(),
        password: localPassword,
      });
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Credenziali admin locali non valide.");
        }
        throw error;
      }

      const target = (location.state as any)?.from || "/admin";
      navigate(target, { replace: true });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Accesso backoffice</CardTitle>
          {isLocalSupabase && (
            <CardDescription className="text-center">
              Ambiente locale Supabase
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLocalSupabase && (
            <p className="text-sm text-muted-foreground text-center">
              Accedi con il tuo account Google @ginepro.cc
            </p>
          )}
          {session && !isAdmin && !authLoading && (
            <p className="text-sm text-destructive text-center">
              Account loggato ma senza permessi admin.
            </p>
          )}
          {isLocalSupabase ? (
            <form onSubmit={signInLocal} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={localEmail}
                  onChange={(event) => setLocalEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={localPassword}
                  onChange={(event) => setLocalPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" disabled={loading || authLoading} className="w-full">
                {loading || authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Accedi
                  </>
                )}
              </Button>
            </form>
          ) : (
            <Button onClick={signInGoogle} disabled={loading || authLoading} className="w-full">
              {loading || authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Accedi con Google
                </>
              )}
            </Button>
          )}
          {session && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => supabase.auth.signOut()}
            >
              Esci
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
