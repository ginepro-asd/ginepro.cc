import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/use-admin-auth";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Accesso backoffice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Accedi con il tuo account Google @ginepro.cc
          </p>
          {session && !isAdmin && !authLoading && (
            <p className="text-sm text-destructive text-center">
              Account loggato ma senza permessi admin.
            </p>
          )}
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
