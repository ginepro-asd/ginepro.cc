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
  const [existingCertificates, setExistingCertificates] = useState<ExistingCertificate[]>([]);
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
          .select("id, email, telefono, codice_fiscale, birth_date, birth_place, identification_type, photo_url, photo_thumb_url")
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

  const handleSelectMatch = async (match: MatchedRegistration) => {
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

    // Fetch valid medical certificates for this participant
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: certs } = await supabase
        .from("medical_certificates")
        .select("id, file_path, expiry_date, disciplines, ai_warning, uploaded_at")
        .eq("participant_id", match.id)
        .gte("expiry_date", today)
        .order("expiry_date", { ascending: false });
      if (certs && certs.length > 0) {
        setExistingCertificates(certs);
      }
    } catch {
      // silently fail
    }

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
    existingCertificates,
    handleSelectMatch,
    handleDismiss,
  };
}
