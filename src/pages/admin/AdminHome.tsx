import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { CalendarDays, Users, Smartphone, FileCheck, Mail, Upload, MessageSquare, ExternalLink } from "lucide-react";

const SECTIONS = [
  { to: "/admin/events", label: "Eventi", icon: CalendarDays, desc: "Gestisci eventi, iscrizioni e dettagli per evento." },
  { to: "/admin/users", label: "Utenti", icon: Users, desc: "Lista partecipanti, profili, modifiche e merge." },
  { to: "/admin/satispay", label: "Satispay", icon: Smartphone, desc: "Account Muvat e configurazione gateway." },
  { to: "/admin/certificates", label: "Certificati medici", icon: FileCheck, desc: "Tutti i certificati caricati con stato e scadenza." },
  { to: "/admin/newsletters", label: "Newsletter", icon: Mail, desc: "Crea e invia newsletter mass-email." },
  { to: "/admin/imports", label: "Import", icon: Upload, desc: "Import da Firestore e da CSV." },
  { to: "/admin/chat", label: "Chat AI", icon: MessageSquare, desc: "Interroga il database con linguaggio naturale." },
];

const AdminHome = () => (
  <div className="space-y-6 max-w-5xl">
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground">Backoffice GINEPRO</h1>
      <p className="text-muted-foreground mt-1">Scegli una sezione da gestire.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {SECTIONS.map((s) => (
        <Link key={s.to} to={s.to} className="group">
          <Card className="h-full transition-shadow group-hover:shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <s.icon className="h-5 w-5 text-primary" />
                {s.label}
                <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-50 transition-opacity" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  </div>
);

export default AdminHome;
