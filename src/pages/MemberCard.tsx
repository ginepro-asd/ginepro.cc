import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import logoLight from "@/assets/logo-light.png";
import logoDark from "@/assets/logo-dark.png";

interface CardData {
  card_number: string;
  year: number;
  participant: {
    nome: string;
    cognome: string;
    photo_thumb_url: string | null;
  };
}

const MemberCard = () => {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) { setError(true); setLoading(false); return; }

    const fetchCard = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("membership_cards")
          .select("card_number, year, participant_id")
          .eq("id", id)
          .single();

        if (fetchErr || !data) throw new Error("Card not found");

        const { data: participant, error: partErr } = await supabase
          .from("participants")
          .select("nome, cognome, photo_thumb_url")
          .eq("id", data.participant_id)
          .single();

        if (partErr || !participant) throw new Error("Participant not found");

        setCard({
          card_number: data.card_number,
          year: data.year,
          participant: {
            nome: participant.nome,
            cognome: participant.cognome,
            photo_thumb_url: participant.photo_thumb_url,
          },
        });
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-foreground">Tessera non trovata</h1>
          <p className="text-muted-foreground">Questa tessera non esiste o non è più valida.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(135deg, hsl(186 65% 6%), hsl(186 60% 14%))" }}>

      {/* Card */}
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl shadow-2xl"
          style={{
            background: "linear-gradient(160deg, hsl(186 60% 26%), hsl(186 65% 18%))",
            aspectRatio: "3.375 / 2.125",
          }}>

          {/* Topographic pattern overlay */}
          <div className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 80 Q50 60 100 80 T200 80' fill='none' stroke='white' stroke-width='0.8'/%3E%3Cpath d='M0 100 Q50 80 100 100 T200 100' fill='none' stroke='white' stroke-width='0.6'/%3E%3Cpath d='M0 120 Q50 100 100 120 T200 120' fill='none' stroke='white' stroke-width='0.5'/%3E%3Cpath d='M0 60 Q50 40 100 60 T200 60' fill='none' stroke='white' stroke-width='0.4'/%3E%3Cpath d='M0 140 Q50 120 100 140 T200 140' fill='none' stroke='white' stroke-width='0.4'/%3E%3C/svg%3E")`,
              backgroundSize: "200px 200px",
            }} />

          {/* Content */}
          <div className="relative h-full flex flex-col justify-between p-6">
            {/* Top row: logo + year */}
            <div className="flex items-start justify-between">
              <img src={logoLight} alt="GINEPRO" className="h-8 object-contain" />
              <span className="text-white/60 text-xs font-mono tracking-widest">{card.year}</span>
            </div>

            {/* Middle: photo + info */}
            <div className="flex items-end gap-4">
              {card.participant.photo_thumb_url && (
                <img
                  src={card.participant.photo_thumb_url}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover border-2 border-white/20 shadow-lg"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white/60 text-[10px] uppercase tracking-[0.2em] mb-1">Socio</p>
                <p className="text-white text-lg font-display font-bold leading-tight truncate">
                  {card.participant.nome}
                </p>
                <p className="text-white text-lg font-display font-bold leading-tight truncate">
                  {card.participant.cognome}
                </p>
              </div>
            </div>

            {/* Bottom: card number */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-white/40 text-[9px] uppercase tracking-[0.2em] mb-0.5">N° Tessera</p>
                <p className="text-white font-mono text-base tracking-[0.15em] font-semibold">
                  {card.card_number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-white/40 text-[9px] uppercase tracking-[0.2em]">A.S.D.</p>
              </div>
            </div>
          </div>

          {/* Accent stripe */}
          <div className="absolute top-0 right-0 w-1.5 h-full"
            style={{ background: "linear-gradient(180deg, hsl(349 88% 75%), hsl(349 70% 60%))" }} />
        </div>

        {/* Below card info */}
        <div className="mt-6 text-center">
          <p className="text-white/40 text-xs">
            GINEPRO A.S.D. — Tessera associativa {card.year}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MemberCard;
