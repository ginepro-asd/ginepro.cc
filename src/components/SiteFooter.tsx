import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

interface SiteFooterProps {
  /** Optional context label (e.g. event name) appended after the copyright */
  context?: string;
  /** Optional admin link (e.g. event-specific admin) */
  adminPath?: string;
}

const SiteFooter = ({ context, adminPath }: SiteFooterProps) => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border/50 bg-background/50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-display text-lg font-bold text-foreground">GINEPRO</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Eventi, tesseramento e community.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Risorse
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/guidelines" className="text-foreground hover:text-primary transition-colors">
                  Linee guida
                </Link>
              </li>
              <li>
                <Link to="/area-riservata" className="text-foreground hover:text-primary transition-colors">
                  Area riservata
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Contatti
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="mailto:info@ginepro.cc"
                  className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  info@ginepro.cc
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Backoffice
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  to={adminPath || "/admin"}
                  className="text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  ⚙ Admin
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
          © {year}{" "}
          <a
            href="https://ginepro.cc"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            GINEPRO
          </a>
          {context ? <> — {context}</> : null}
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
