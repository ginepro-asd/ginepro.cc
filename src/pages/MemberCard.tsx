import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import "./Card.css";

interface CardData {
  card_number: string;
  year: number;
  participant: {
    nome: string;
    cognome: string;
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
          .select("nome, cognome")
          .eq("id", data.participant_id)
          .single();

        if (partErr || !participant) throw new Error("Participant not found");

        setCard({
          card_number: data.card_number,
          year: data.year,
          participant: {
            nome: participant.nome,
            cognome: participant.cognome,
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

  useGSAP(() => {
    if (!card) return;
    gsap.registerPlugin(MotionPathPlugin);

    const tl = gsap
      .timeline()
      .set("svg", { opacity: 1 })
      .set(".scratches", { rotation: 70, x: 450, y: -10 })
      .set("#tri2", { scale: 0.5 })
      .from(
        "#cardMask rect",
        {
          scale: 0,
          rotation: -20,
          duration: 2,
          transformOrigin: "50% 50%",
          ease: "expo.inOut",
        },
        0,
      )
      .to(
        "#tri1",
        {
          motionPath: {
            path: "#midC",
            align: "#midC",
            alignOrigin: [0.5, 0.5],
            autoRotate: true,
            start: 1,
            end: 0,
          },
          duration: 6,
          repeat: -1,
          ease: "none",
          repeatDelay: 1,
        },
        0.5,
      )
      .to(
        "#tri2",
        {
          motionPath: {
            path: "#innerC",
            align: "#innerC",
            alignOrigin: [0.5, 0.5],
            autoRotate: true,
            start: 0,
            end: 1,
          },
          duration: 5,
          repeat: -1,
          ease: "none",
          repeatDelay: 1,
        },
        1.5,
      )
      .from(
        ".coil",
        {
          attr: { "stroke-dashoffset": (i: number) => (i === 1 ? -28 : 28) },
          ease: "none",
          duration: 1,
          repeat: -1,
        },
        1,
      )
      .fromTo(
        "#orb1",
        { y: 160 },
        { y: -20, ease: "circ", repeat: -1, yoyo: true, duration: 1 },
        0.8,
      )
      .from(
        ".logoPt",
        { x: (i: number) => [18, -10][i], duration: 1.2, ease: "expo.inOut" },
        0.9,
      )
      .from(
        "svg text",
        { x: -40, duration: 1.1, ease: "expo.inOut", stagger: 0.2 },
        1,
      )
      .from(
        ".txtBox",
        {
          scaleX: 0,
          transformOrigin: "100% 0",
          duration: 1.1,
          ease: "expo.inOut",
          stagger: 0.2,
        },
        1,
      )
      .fromTo(
        "#wave1",
        { x: 0, y: 0 },
        { duration: 5, x: -701, y: 815, repeat: -1, ease: "none" },
        0,
      )
      .fromTo(
        "#wave2",
        { x: 0, y: 0 },
        {
          duration: 6,
          x: 804,
          y: -917,
          repeat: -1,
          ease: "none",
          onRepeat: () => starShine.play(0),
        },
        0,
      );

    const starShine = gsap
      .timeline()
      .set("#star", { scale: 0, transformOrigin: "50% 50%", x: 2, y: 10 })
      .to(
        "#star",
        {
          scale: 1,
          repeat: 1,
          yoyo: true,
          yoyoEase: true,
          duration: 0.4,
          ease: "power4",
        },
        0,
      )
      .fromTo(
        "#star",
        { rotate: -20 },
        { rotate: 120, duration: 0.8, ease: "none" },
        0,
      );

    // Allow replaying animation on click
    const svgEl = document.querySelector(".card-container svg");
    const handler = () => tl.play(0);
    svgEl?.addEventListener("click", handler);
    return () => svgEl?.removeEventListener("click", handler);
  }, [card]);

  const lblu = "#7ADBD4";
  const purple = "#035C67";
  const red = "#FA7598";
  const blu = "#4A8A90";

  if (loading) {
    return (
      <div className="card-container">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="card-container">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-white">Tessera non trovata</h1>
          <p className="text-white/60">Questa tessera non esiste o non è più valida.</p>
        </div>
      </div>
    );
  }

  const fullName = `${card.participant.nome} ${card.participant.cognome}`;

  return (
    <div className="card-container">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 440">
        <defs>
          <clipPath id="cardMask">
            <rect width="700" height="440" rx="30" ry="30" />
          </clipPath>

          <pattern id="wave1" x="0" y="0" width="701" height="815" patternUnits="userSpaceOnUse">
            <path
              d="M-10 -100 L750 -1100 750 -900 -10 100Z"
              fill="none"
              stroke={lblu}
              strokeWidth="1"
              opacity="0.5"
            />
            <path
              d="M-10 -60 L750 -1060 750 -860 -10 140Z"
              fill="none"
              stroke={lblu}
              strokeWidth="0.5"
              opacity="0.3"
            />
          </pattern>

          <pattern id="wave2" x="0" y="0" width="804" height="917" patternUnits="userSpaceOnUse">
            <path
              d="M-10 900 L850 0 850 200 -10 1100Z"
              fill="none"
              stroke={red}
              strokeWidth="1"
              opacity="0.4"
            />
            <path
              d="M-10 940 L850 40 850 240 -10 1140Z"
              fill="none"
              stroke={red}
              strokeWidth="0.5"
              opacity="0.2"
            />
          </pattern>

          <path
            id="outerC"
            d="M350,40 A180,180 0 1,1 349.99,40"
            fill="none"
          />
          <path
            id="midC"
            d="M350,80 A140,140 0 1,1 349.99,80"
            fill="none"
          />
          <path
            id="innerC"
            d="M350,130 A90,90 0 1,1 349.99,130"
            fill="none"
          />
        </defs>

        <g clipPath="url(#cardMask)">
          {/* Background */}
          <rect width="700" height="440" fill={purple} />

          {/* Animated wave patterns */}
          <rect width="2000" height="2000" fill="url(#wave1)" x="-200" y="-200" />
          <rect width="2000" height="2000" fill="url(#wave2)" x="-200" y="-200" />

          {/* Scratches texture */}
          <g className="scratches" opacity="0.03">
            <line x1="0" y1="0" x2="600" y2="600" stroke="white" strokeWidth="0.5" />
            <line x1="50" y1="0" x2="650" y2="600" stroke="white" strokeWidth="0.3" />
            <line x1="100" y1="0" x2="700" y2="600" stroke="white" strokeWidth="0.5" />
            <line x1="-50" y1="0" x2="550" y2="600" stroke="white" strokeWidth="0.3" />
          </g>

          {/* Orbiting triangles */}
          <polygon id="tri1" points="0,-6 5,4 -5,4" fill={lblu} opacity="0.6" />
          <polygon id="tri2" points="0,-4 3.5,3 -3.5,3" fill={red} opacity="0.5" />

          {/* Coils */}
          <circle
            className="coil"
            cx="350"
            cy="220"
            r="140"
            fill="none"
            stroke={lblu}
            strokeWidth="0.5"
            strokeDasharray="4 24"
            opacity="0.3"
          />
          <circle
            className="coil"
            cx="350"
            cy="220"
            r="100"
            fill="none"
            stroke={red}
            strokeWidth="0.5"
            strokeDasharray="4 24"
            opacity="0.2"
          />

          {/* Orb */}
          <circle id="orb1" cx="350" cy="220" r="3" fill={lblu} opacity="0.5" />

          {/* Star */}
          <polygon
            id="star"
            points="350,205 353,215 363,215 355,221 358,231 350,225 342,231 345,221 337,215 347,215"
            fill="white"
            opacity="0.8"
          />

          {/* Logo - simplified Ginepro mark */}
          <g transform="translate(40, 30)">
            <path
              className="logoPt"
              d="M0,0 L20,35 L40,0Z"
              fill={lblu}
              opacity="0.9"
            />
            <path
              className="logoPt"
              d="M15,5 L25,25 L35,5Z"
              fill="white"
              opacity="0.3"
            />
          </g>

          {/* Text backgrounds */}
          <rect className="txtBox" x="30" y="320" width="250" height="32" rx="4" fill={blu} opacity="0.3" />
          <rect className="txtBox" x="30" y="370" width="180" height="28" rx="4" fill={blu} opacity="0.2" />

          {/* Text content */}
          <text x="40" y="300" fill="white" fontSize="11" opacity="0.4" fontWeight="500" letterSpacing="3">
            SOCIO
          </text>
          <text x="40" y="344" fill="white" fontSize="22" fontWeight="700" letterSpacing="1">
            {fullName}
          </text>
          <text x="40" y="390" fill={lblu} fontSize="16" fontWeight="600" fontFamily="'Space Grotesk', monospace" letterSpacing="3">
            {card.card_number}
          </text>

          {/* Year */}
          <text x="620" y="50" fill="white" fontSize="12" opacity="0.35" fontFamily="'Space Grotesk', monospace" letterSpacing="4" textAnchor="end">
            {card.year}
          </text>

          {/* Bottom right ASD label */}
          <text x="660" y="415" fill="white" fontSize="9" opacity="0.25" letterSpacing="2" textAnchor="end">
            GINEPRO A.S.D.
          </text>

          {/* Accent stripe */}
          <rect x="695" y="0" width="5" height="440" fill={red} opacity="0.8" />
        </g>
      </svg>
    </div>
  );
};

export default MemberCard;
