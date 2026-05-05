import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

interface AdminAuthState {
  loading: boolean;
  session: Session | null;
  isAdmin: boolean;
  /** Legacy admin password fetched from backend, used to call existing edge functions */
  adminPassword: string | null;
  email: string | null;
}

let cachedPassword: string | null = null;
let cachedEmail: string | null = null;

export function useAdminAuth(): AdminAuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AdminAuthState>({
    loading: true,
    session: null,
    isAdmin: false,
    adminPassword: cachedPassword,
    email: cachedEmail,
  });

  useEffect(() => {
    let mounted = true;

    const verifyAdmin = async (session: Session | null) => {
      if (!session) {
        cachedPassword = null;
        cachedEmail = null;
        if (mounted) setState({ loading: false, session: null, isAdmin: false, adminPassword: null, email: null });
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("admin-token", { body: {} });
        if (error || !data?.isAdmin) {
          cachedPassword = null;
          cachedEmail = null;
          if (mounted) setState({ loading: false, session, isAdmin: false, adminPassword: null, email: session.user.email ?? null });
          return;
        }
        cachedPassword = data.password ?? null;
        cachedEmail = data.email ?? session.user.email ?? null;
        if (mounted) setState({ loading: false, session, isAdmin: true, adminPassword: cachedPassword, email: cachedEmail });
      } catch {
        if (mounted) setState({ loading: false, session, isAdmin: false, adminPassword: null, email: session.user.email ?? null });
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // defer call to avoid deadlock
      setTimeout(() => verifyAdmin(session), 0);
    });

    supabase.auth.getSession().then(({ data: { session } }) => verifyAdmin(session));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    cachedPassword = null;
    cachedEmail = null;
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
