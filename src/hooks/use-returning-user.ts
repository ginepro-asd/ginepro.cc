import { useState, useEffect, useRef } from "react";
import { UseFormReturn } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MatchedRegistration,
  ExistingCertificate,
  obfuscateEmail,
  obfuscatePhone,
  obfuscateCF,
  COUNTRY_CODES,
} from "@/lib/registration-utils";

interface UseReturningUserOptions {
  watchedNome: string;
  watchedCognome: string;
  form: UseFormReturn<any>;
  setCountryCode: (code: string) => void;
  setIdentificationType: (type: "birth" | "fiscal") => void;
}

export function useReturningUser({
  watchedNome,
  watchedCognome,
  form,
  setCountryCode,
  setIdentificationType,
}: UseReturningUserOptions) {
  const [matchedUsers, setMatchedUsers] = useState<MatchedRegistration[]>([]);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchDismissed, setMatchDismissed] = useState(false);
  const [returningUserData, setReturningUserData] = useState<MatchedRegistration | null>(null);
  const lookupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Lookup existing participants by nome+cognome (debounced)
  useEffect(() => {
    if (matchDismissed) return;
    if (!watchedNome?.trim() || !watchedCognome?.trim()) {
      setMatchedUsers([]);
      return;
    }
    if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
    lookupTimeoutRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("participants")
          .select("id, email, telefono, codice_fiscale, birth_date, birth_place, identification_type")
          .ilike("nome", watchedNome.trim())
          .ilike("cognome", watchedCognome.trim())
          .limit(10);
        if (data && data.length > 0) {
          setMatchedUsers(data);
          setShowMatchDialog(true);
        } else {
          setMatchedUsers([]);
        }
      } catch {
        // silently fail
      }
    }, 800);
    return () => {
      if (lookupTimeoutRef.current) clearTimeout(lookupTimeoutRef.current);
    };
  }, [watchedNome, watchedCognome, matchDismissed]);

  const handleSelectMatch = (match: MatchedRegistration) => {
    setReturningUserData(match);
    form.setValue("email", obfuscateEmail(match.email));
    form.setValue("telefono", obfuscatePhone(match.telefono));
    const phoneMatch = match.telefono.match(/^(\+\d{1,3})/);
    if (phoneMatch) {
      const cc = COUNTRY_CODES.find((c) => c.code === phoneMatch[1]);
      if (cc) setCountryCode(cc.code);
    }
    if (match.codice_fiscale) {
      form.setValue("codiceFiscale", obfuscateCF(match.codice_fiscale));
      setIdentificationType("fiscal");
      form.setValue("identificationType", "fiscal");
    }
    if (match.birth_date) form.setValue("birthDate", match.birth_date);
    if (match.birth_place) form.setValue("birthPlace", match.birth_place);
    setShowMatchDialog(false);
    setMatchDismissed(true);
    toast({ title: "Dati recuperati!", description: "Abbiamo precompilato il form con i tuoi dati." });
  };

  const handleDismiss = () => {
    setShowMatchDialog(false);
    setMatchDismissed(true);
  };

  return {
    matchedUsers,
    showMatchDialog,
    setShowMatchDialog,
    matchDismissed,
    returningUserData,
    handleSelectMatch,
    handleDismiss,
  };
}
