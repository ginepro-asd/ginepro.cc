import CodiceFiscale from "codice-fiscale-js";
import { CreditCard, Smartphone, CircleDollarSign } from "lucide-react";
import React from "react";

// === Obfuscation helpers ===

/** Obfuscate email: ma***o@gm***l.com */
export function obfuscateEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***.***";
  const oLocal = local.length <= 2 ? local[0] + "***" : local[0] + local[1] + "***" + local.slice(-1);
  const parts = domain.split(".");
  const oDomain = parts[0].length <= 2 ? parts[0][0] + "***" : parts[0][0] + parts[0][1] + "***" + parts[0].slice(-1);
  return `${oLocal}@${oDomain}.${parts.slice(1).join(".")}`;
}

/** Obfuscate phone: +39 33***567 */
export function obfuscatePhone(phone: string): string {
  if (phone.length <= 6) return "***";
  return phone.slice(0, phone.length > 10 ? 6 : 3) + "***" + phone.slice(-3);
}

/** Obfuscate CF: RSS***85M***01Z */
export function obfuscateCF(cf: string | null): string {
  if (!cf || cf.length < 10) return "***";
  return cf.slice(0, 3) + "***" + cf.slice(6, 9) + "***" + cf.slice(-2);
}

// === Matched registration interface ===

export interface MatchedRegistration {
  id: string;
  email: string;
  telefono: string;
  codice_fiscale: string | null;
  birth_date: string | null;
  birth_place: string | null;
  identification_type: string;
}

// === Codice Fiscale helpers ===

/** Strip province suffix: "Faenza (RA)" → "Faenza" */
export function stripProvincia(comune: string): string {
  return comune.replace(/\s*\([A-Z]{2}\)$/, "");
}

/** Extract provincia code: "Faenza (RA)" → "RA" */
export function extractProvincia(comune: string): string {
  const match = comune.match(/\(([A-Z]{2})\)$/);
  return match ? match[1] : "";
}

/** Try to compute codice fiscale from personal data */
export function tryComputeCF(
  nome: string,
  cognome: string,
  birthDate: string,
  birthPlace: string,
  gender: "M" | "F",
  bornAbroad: boolean
): string | null {
  if (!nome || !cognome || !birthDate || !birthPlace || !gender) return null;
  try {
    const date = new Date(birthDate);
    const placeName = bornAbroad ? birthPlace : stripProvincia(birthPlace);
    const cf = new CodiceFiscale({
      name: nome,
      surname: cognome,
      gender,
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      birthplace: placeName,
      birthplaceProvincia: bornAbroad ? "EE" : extractProvincia(birthPlace),
    });
    return cf.toString();
  } catch {
    return null;
  }
}

/** Try to extract birth data from codice fiscale */
export function tryInverseCF(cf: string): {
  birthDate: string;
  birthPlace: string;
  birthPlaceProvincia: string;
  gender: "M" | "F";
} | null {
  if (!cf || cf.length < 16) return null;
  try {
    if (!CodiceFiscale.check(cf)) return null;
    const data = CodiceFiscale.computeInverse(cf);
    const y = data.year;
    const m = String(data.month).padStart(2, "0");
    const d = String(data.day).padStart(2, "0");
    return {
      birthDate: `${y}-${m}-${d}`,
      birthPlace: data.birthplace,
      birthPlaceProvincia: data.birthplaceProvincia,
      gender: data.gender,
    };
  } catch {
    return null;
  }
}

// === Constants ===

export const COUNTRY_CODES = [
  { code: "+39", country: "🇮🇹 IT", label: "Italia" },
  { code: "+41", country: "🇨🇭 CH", label: "Svizzera" },
  { code: "+43", country: "🇦🇹 AT", label: "Austria" },
  { code: "+33", country: "🇫🇷 FR", label: "Francia" },
  { code: "+49", country: "🇩🇪 DE", label: "Germania" },
  { code: "+44", country: "🇬🇧 GB", label: "Regno Unito" },
  { code: "+34", country: "🇪🇸 ES", label: "Spagna" },
  { code: "+1", country: "🇺🇸 US", label: "USA" },
];

export const PAYMENT_LABELS: Record<string, string> = {
  stripe: "Carta",
  satispay: "Satispay",
  paypal: "PayPal",
};
