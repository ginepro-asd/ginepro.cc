import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "./Card.css";

interface CardData {
  card_number: string;
  year: number;
  participant: {
    nome: string;
    cognome: string;
    photo_thumb_url: string | null;
    photo_url: string | null;
  };
}

const LOGO_SRC = "/logos/ginepro-logo-bianco.svg";

const MemberCard = () => {
  const { id } = useParams<{ id: string }>();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("card-page-active");
    document.body.classList.add("card-page-active");

    return () => {
      document.documentElement.classList.remove("card-page-active");
      document.body.classList.remove("card-page-active");
    };
  }, []);

  useEffect(() => {
    if (!id) {
      setError(true);
      setLoading(false);
      return;
    }

    const fetchCard = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("membership_cards")
          .select("card_number, year, participant_id")
          .eq("id", id)
          .single();

        if (fetchErr || !data) {
          throw new Error("Card not found");
        }

        const { data: participant, error: partErr } = await supabase
          .from("participants")
          .select("nome, cognome, photo_thumb_url, photo_url")
          .eq("id", data.participant_id)
          .single();

        if (partErr || !participant) {
          throw new Error("Participant not found");
        }

        setCard({
          card_number: data.card_number,
          year: data.year,
          participant: {
            nome: participant.nome,
            cognome: participant.cognome,
            photo_thumb_url: participant.photo_thumb_url,
            photo_url: participant.photo_url,
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

  useGSAP(
    () => {
      if (!card) {
        return;
      }

      gsap.registerPlugin(MotionPathPlugin);

      const starShine = gsap
        .timeline({ paused: true })
        .set("#star", { scale: 0, opacity: 0, transformOrigin: "50% 50%" })
        .to(
          "#star",
          {
            scale: 1.12,
            opacity: 1,
            duration: 0.42,
            repeat: 1,
            yoyo: true,
            ease: "power4.out",
          },
          0,
        )
        .fromTo(
          "#star",
          { rotate: -24 },
          { rotate: 120, duration: 0.82, ease: "none" },
          0,
        );

      const tl = gsap
        .timeline()
        .set("svg", { opacity: 1 })
        .set(".scratches", { rotation: 16, x: 240, y: -96, transformOrigin: "50% 50%" })
        .set("#tri2", { scale: 0.56, transformOrigin: "50% 50%" })
        .from(
          ".card-stage",
          {
            scale: 0.84,
            rotate: -14,
            y: 34,
            opacity: 0,
            transformOrigin: "50% 50%",
            duration: 1.75,
            ease: "expo.inOut",
          },
          0,
        )
        .from(
          ".card-shadow",
          {
            scale: 0.9,
            opacity: 0,
            transformOrigin: "50% 50%",
            duration: 1.25,
            ease: "expo.out",
          },
          0.05,
        )
        .from(
          ".ambient-glow",
          {
            scale: 0.4,
            opacity: 0,
            transformOrigin: "50% 50%",
            duration: 1.2,
            stagger: 0.08,
            ease: "power3.out",
          },
          0.08,
        )
        .from(
          ".frame-line",
          {
            scaleX: 0,
            transformOrigin: "0% 50%",
            duration: 1,
            stagger: 0.06,
            ease: "expo.inOut",
          },
          0.38,
        )
        .from(
          ".photo-shell",
          {
            x: -36,
            opacity: 0,
            duration: 1.02,
            ease: "expo.out",
          },
          0.48,
        )
        .from(
          ".photo-thumb",
          {
            scale: 1.18,
            opacity: 0,
            transformOrigin: "50% 50%",
            duration: 1.2,
            ease: "expo.out",
          },
          0.56,
        )
        .from(
          ".photo-overlay",
          {
            yPercent: 100,
            opacity: 0,
            duration: 0.9,
            ease: "expo.out",
          },
          0.62,
        )
        .from(
          ".logo-group",
          {
            x: -24,
            opacity: 0,
            duration: 0.95,
            ease: "expo.out",
          },
          0.75,
        )
        .from(
          ".eyebrow",
          {
            y: 16,
            opacity: 0,
            duration: 0.72,
            ease: "power3.out",
          },
          0.95,
        )
        .from(
          ".member-name",
          {
            y: 28,
            opacity: 0,
            duration: 0.92,
            ease: "expo.out",
          },
          1.02,
        )
        .from(
          ".member-meta",
          {
            y: 22,
            opacity: 0,
            duration: 0.85,
            stagger: 0.12,
            ease: "power3.out",
          },
          1.08,
        )
        .from(
          ".member-chip",
          {
            scaleX: 0,
            opacity: 0,
            transformOrigin: "0% 50%",
            duration: 0.75,
            stagger: 0.1,
            ease: "expo.inOut",
          },
          1.12,
        )
        .from(
          ".footer-copy",
          {
            y: 14,
            opacity: 0,
            duration: 0.7,
            ease: "power2.out",
          },
          1.22,
        )
        .from(
          ".orbit-label",
          {
            x: 14,
            opacity: 0,
            duration: 0.72,
            ease: "power2.out",
          },
          1.05,
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
            duration: 6.2,
            repeat: -1,
            ease: "none",
            repeatDelay: 1,
          },
          0.45,
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
            duration: 5.1,
            repeat: -1,
            ease: "none",
            repeatDelay: 1,
          },
          0.8,
        )
        .from(
          ".coil",
          {
            attr: { "stroke-dashoffset": (index: number) => (index === 1 ? -28 : 28) },
            duration: 1,
            repeat: -1,
            ease: "none",
          },
          0.72,
        )
        .fromTo(
          "#orb1",
          { y: 148 },
          { y: -14, duration: 1.1, repeat: -1, yoyo: true, ease: "circ.inOut" },
          0.68,
        )
        .fromTo(
          "#wave1",
          { x: 0, y: 0 },
          { x: -701, y: 815, duration: 6.2, repeat: -1, ease: "none" },
          0,
        )
        .fromTo(
          "#wave2",
          { x: 0, y: 0 },
          {
            x: 804,
            y: -917,
            duration: 7.1,
            repeat: -1,
            ease: "none",
            onRepeat: () => starShine.restart(),
          },
          0,
        );

      const svgEl = containerRef.current?.querySelector("svg");
      const handleReplay = () => {
        starShine.pause(0);
        tl.restart();
      };

      svgEl?.addEventListener("click", handleReplay);

      return () => {
        svgEl?.removeEventListener("click", handleReplay);
      };
    },
    { dependencies: [card], scope: containerRef },
  );

  if (loading) {
    return (
      <div ref={containerRef} className="card-container">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div ref={containerRef} className="card-container">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-white">Tessera non trovata</h1>
          <p className="text-white/60">Questa tessera non esiste o non e piu valida.</p>
        </div>
      </div>
    );
  }

  const fullName = `${card.participant.nome} ${card.participant.cognome}`;
  const photoSrc = card.participant.photo_thumb_url || card.participant.photo_url;
  const initials = `${card.participant.nome.charAt(0)}${card.participant.cognome.charAt(0)}`.toUpperCase();
  const nameFontSize = fullName.length > 24 ? 28 : 34;

  return (
    <div ref={containerRef} className="card-container">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 440" aria-label={`Tessera di ${fullName}`}>
        <defs>
          <clipPath id="cardMask">
            <rect width="700" height="440" rx="34" ry="34" />
          </clipPath>

          <clipPath id="photoClip">
            <rect x="42" y="100" width="146" height="186" rx="28" ry="28" />
          </clipPath>

          <linearGradient id="cardGradient" x1="0" y1="0" x2="700" y2="440" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#060606" />
            <stop offset="52%" stopColor="#0b0d0e" />
            <stop offset="100%" stopColor="#050607" />
          </linearGradient>

          <linearGradient id="photoShade" x1="42" y1="100" x2="188" y2="286" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="72%" stopColor="#000" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.48" />
          </linearGradient>

          <radialGradient id="cyanGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(560 88) rotate(86.6) scale(184 212)">
            <stop offset="0%" stopColor="#7ADBD4" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#7ADBD4" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="coralGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(108 356) rotate(38) scale(170 136)">
            <stop offset="0%" stopColor="#FA7598" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#FA7598" stopOpacity="0" />
          </radialGradient>

          <pattern id="wave1" x="0" y="0" width="701" height="815" patternUnits="userSpaceOnUse">
            <path
              d="M-10 -100 L750 -1100 750 -900 -10 100Z"
              fill="none"
              stroke="#7ADBD4"
              strokeWidth="1"
              opacity="0.34"
            />
            <path
              d="M-10 -60 L750 -1060 750 -860 -10 140Z"
              fill="none"
              stroke="#7ADBD4"
              strokeWidth="0.5"
              opacity="0.2"
            />
          </pattern>

          <pattern id="wave2" x="0" y="0" width="804" height="917" patternUnits="userSpaceOnUse">
            <path
              d="M-10 900 L850 0 850 200 -10 1100Z"
              fill="none"
              stroke="#FA7598"
              strokeWidth="1"
              opacity="0.26"
            />
            <path
              d="M-10 940 L850 40 850 240 -10 1140Z"
              fill="none"
              stroke="#FA7598"
              strokeWidth="0.5"
              opacity="0.14"
            />
          </pattern>

          <path id="midC" d="M460,96 A154,154 0 1,1 459.99,96" fill="none" />
          <path id="innerC" d="M460,136 A112,112 0 1,1 459.99,136" fill="none" />
        </defs>

        <ellipse className="card-shadow" cx="350" cy="408" rx="262" ry="22" fill="#000" opacity="0.52" />

        <g className="card-stage" clipPath="url(#cardMask)">
          <rect className="card-surface" width="700" height="440" rx="34" fill="url(#cardGradient)" />

          <circle className="ambient-glow" cx="560" cy="88" r="184" fill="url(#cyanGlow)" />
          <circle className="ambient-glow" cx="108" cy="356" r="156" fill="url(#coralGlow)" />

          <rect width="2000" height="2000" x="-250" y="-260" fill="url(#wave1)" />
          <rect width="2000" height="2000" x="-260" y="-240" fill="url(#wave2)" />

          <g className="scratches" opacity="0.06">
            <line x1="-40" y1="0" x2="540" y2="620" stroke="#fff" strokeWidth="0.65" />
            <line x1="20" y1="-20" x2="620" y2="610" stroke="#fff" strokeWidth="0.35" />
            <line x1="80" y1="-10" x2="700" y2="650" stroke="#fff" strokeWidth="0.55" />
            <line x1="170" y1="-40" x2="780" y2="610" stroke="#fff" strokeWidth="0.25" />
          </g>

          <g fill="none" strokeWidth="1.2" strokeDasharray="6 2 4 2.5 4 3 3.5 3">
            <path
              className="coil"
              d="M100,402C18,344,-18,222,24,126S172,-8,304,24"
              stroke="#7ADBD4"
              opacity="0.22"
            />
            <path
              className="coil"
              d="M252,380C172,324,152,226,188,148S312,34,430,72"
              stroke="#FA7598"
              opacity="0.18"
            />
          </g>

          <polygon id="tri1" points="0,-10 8,6 -8,6" fill="#7ADBD4" opacity="0.76" />
          <polygon id="tri2" points="0,-8 6,5 -6,5" fill="#FA7598" opacity="0.68" />
          <circle id="orb1" cx="460" cy="248" r="4" fill="#7ADBD4" opacity="0.78" />

          <path
            id="star"
            fill="#fff"
            d="M593,60c2.8-2.8,5.7-8.6,5.7-8.6s0.7,3.6,4.2,7.2c5.8,5.8,8.6,5.8,8.6,5.8s-2.8,1.4-7.2,5.7c-4.3,4.3-5.7,8.6-5.7,8.6s-2.2-5-5.7-8.6c-3.6-3.6-7.9-5-7.9-5S590.2,62.8,593,60z"
            opacity="0.85"
          />

          <image
            className="logo-group"
            href={LOGO_SRC}
            x="36"
            y="34"
            width="218"
            height="36"
            preserveAspectRatio="xMinYMin meet"
          />

          <rect className="frame-line" x="228" y="94" width="398" height="1.2" fill="rgba(255,255,255,0.22)" />
          <rect className="frame-line" x="228" y="304" width="170" height="1" fill="rgba(255,255,255,0.12)" />
          <rect className="frame-line" x="36" y="306" width="154" height="1" fill="rgba(255,255,255,0.12)" />

          <g className="photo-shell">
            <rect x="36" y="94" width="158" height="198" rx="30" fill="rgba(255,255,255,0.05)" />
            <rect
              x="39"
              y="97"
              width="152"
              height="192"
              rx="28"
              fill="none"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1.5"
            />

            <g clipPath="url(#photoClip)">
              {photoSrc ? (
                <image
                  className="photo-thumb"
                  href={photoSrc}
                  x="42"
                  y="100"
                  width="146"
                  height="186"
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <>
                  <rect className="photo-thumb" x="42" y="100" width="146" height="186" fill="#0f1415" />
                  <text
                    className="photo-thumb"
                    x="115"
                    y="205"
                    fill="#7ADBD4"
                    fontSize="48"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {initials}
                  </text>
                </>
              )}
              <rect className="photo-overlay" x="42" y="100" width="146" height="186" fill="url(#photoShade)" />
            </g>
          </g>


          <text
            className="member-name"
            x="228"
            y="206"
            fill="#fff"
            fontSize={nameFontSize}
            fontWeight="700"
          >
            {fullName}
          </text>

          <g className="member-meta">
            <text x="228" y="246" fill="rgba(255,255,255,0.48)" fontSize="12" letterSpacing="3">
              NUMERO TESSERA
            </text>
            <text className="card-mono" x="228" y="276" fill="#fff" fontSize="22" fontWeight="600">
              {card.card_number}
            </text>
          </g>

          <g className="member-chip">
            <rect x="228" y="326" width="128" height="38" rx="19" fill="rgba(122,219,212,0.12)" />
            <text
              className="card-mono"
              x="292"
              y="350"
              fill="#7ADBD4"
              fontSize="14"
              fontWeight="700"
              letterSpacing="2"
              textAnchor="middle"
            >
              {card.year}
            </text>
          </g>

          <g className="member-chip">
            <rect x="370" y="326" width="186" height="38" rx="19" fill="rgba(250,117,152,0.12)" />
            <text
              className="card-mono"
              x="463"
              y="350"
              fill="#FA7598"
              fontSize="13"
              fontWeight="700"
              letterSpacing="2.6"
              textAnchor="middle"
            >
              GINEPRO A.S.D.
            </text>
          </g>

          <text
            className="footer-copy card-mono"
            x="42"
            y="372"
            fill="#fff"
            fontSize="14"
            fontWeight="500"
          >
            {photoSrc ? "Profilo verificato" : "Foto non disponibile"}
          </text>
        </g>
      </svg>
    </div>
  );
};

export default MemberCard;
