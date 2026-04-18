/**
 * Calcola la deadline effettiva per le iscrizioni online.
 * Le iscrizioni si chiudono al MIN tra:
 *  - scadenza_iscrizioni (se impostata)
 *  - data_evento - chiusura_ore_prima (default 24h)
 */
export function getEffectiveDeadline(event: {
  scadenza_iscrizioni: string | null;
  data_evento: string | null;
  chiusura_ore_prima?: number | null;
}): Date {
  const FAR_FUTURE = new Date("2099-12-31");
  const explicit = event.scadenza_iscrizioni ? new Date(event.scadenza_iscrizioni) : null;

  let eventCutoff: Date | null = null;
  if (event.data_evento) {
    const eventStart = new Date(event.data_evento);
    if (!isNaN(eventStart.getTime())) {
      const hours = event.chiusura_ore_prima ?? 24;
      eventCutoff = new Date(eventStart.getTime() - hours * 60 * 60 * 1000);
    }
  }

  const candidates = [explicit, eventCutoff].filter((d): d is Date => d !== null);
  if (candidates.length === 0) return FAR_FUTURE;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

export const CLOSED_REGISTRATION_MESSAGE =
  "Verifica sul regolamento se le iscrizioni sul posto sono disponibili.";
