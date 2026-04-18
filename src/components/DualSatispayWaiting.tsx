import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle, XCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/hooks/use-event";

interface DualSatispayWaitingProps {
  paymentIdA: string;
  registrationIdA: string;
  paymentIdB: string;
  registrationIdB: string;
  onCancel: () => void;
  eventSlug: string;
  priceEach: number;
  nameA: string;
  nameB: string;
}

type PaymentStatus = "pending" | "paid" | "cancelled" | "error";

const DualSatispayWaiting = ({
  paymentIdA, registrationIdA, paymentIdB, registrationIdB,
  onCancel, eventSlug, priceEach, nameA, nameB,
}: DualSatispayWaitingProps) => {
  const [statusA, setStatusA] = useState<PaymentStatus>("pending");
  const [statusB, setStatusB] = useState<PaymentStatus>("pending");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const adminTokenSuffix = searchParams.get("token") === "gin" ? "&token=gin" : "";

  const bothPaid = statusA === "paid" && statusB === "paid";
  const anyFailed = statusA === "cancelled" || statusA === "error" || statusB === "cancelled" || statusB === "error";

  useEffect(() => {
    if (bothPaid) {
      setTimeout(() => {
        navigate(`/${eventSlug}/conferma?registration_id=${registrationIdA}&provider=satispay&pair=true${adminTokenSuffix}`);
      }, 2000);
    }
  }, [bothPaid, navigate, eventSlug, registrationIdA, adminTokenSuffix]);

  useEffect(() => {
    const check = async () => {
      try {
        const [resA, resB] = await Promise.all([
          supabase.functions.invoke("check-satispay-payment", {
            body: { payment_id: paymentIdA, registration_id: registrationIdA },
          }),
          supabase.functions.invoke("check-satispay-payment", {
            body: { payment_id: paymentIdB, registration_id: registrationIdB },
          }),
        ]);

        if (resA.data?.status === "completed") setStatusA("paid");
        else if (resA.data?.status === "cancelled") setStatusA("cancelled");

        if (resB.data?.status === "completed") setStatusB("paid");
        else if (resB.data?.status === "cancelled") setStatusB("cancelled");
      } catch {}
    };

    check();
    intervalRef.current = setInterval(check, 3000);
    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (statusA === "pending") setStatusA("error");
      if (statusB === "pending") setStatusB("error");
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
  }, [paymentIdA, paymentIdB, registrationIdA, registrationIdB]);

  // Stop polling when both resolved
  useEffect(() => {
    if ((statusA !== "pending" && statusB !== "pending") && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, [statusA, statusB]);

  const renderStatus = (name: string, status: PaymentStatus) => (
    <div className={`flex items-center gap-3 border rounded-lg p-3 transition-all ${
      status === "paid" ? "border-green-500/50 bg-green-500/5" : 
      status === "pending" ? "border-border" : "border-destructive/50 bg-destructive/5"
    }`}>
      {status === "pending" && <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />}
      {status === "paid" && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
      {(status === "cancelled" || status === "error") && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{name}</span>
        <span className="text-xs text-muted-foreground">
          {status === "pending" && "In attesa..."}
          {status === "paid" && "Pagato ✓"}
          {status === "cancelled" && "Annullato"}
          {status === "error" && "Tempo scaduto"}
        </span>
      </div>
      <span className="text-sm font-mono font-semibold text-muted-foreground">{formatPrice(priceEach)}</span>
    </div>
  );

  return (
    <Card className="border-border/50 shadow-xl bg-card/80 backdrop-blur-sm">
      <CardContent className="pt-8 pb-8 text-center space-y-6">
        {!bothPaid && !anyFailed && (
          <>
            <div className="relative mx-auto w-20 h-20">
              <Smartphone className="h-12 w-12 absolute inset-0 m-auto text-primary" />
              <Loader2 className="h-20 w-20 absolute inset-0 animate-spin text-primary/30" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">In attesa dei pagamenti</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Ogni componente deve confermare il pagamento di <strong className="text-secondary">{formatPrice(priceEach)}</strong> su Satispay
              </p>
            </div>
          </>
        )}

        {bothPaid && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Entrambi i pagamenti ricevuti!</h3>
              <p className="text-muted-foreground text-sm">Reindirizzamento alla conferma...</p>
            </div>
          </>
        )}

        {anyFailed && !bothPaid && (
          <>
            <XCircle className="h-16 w-16 mx-auto text-destructive" />
            <div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">Pagamento non riuscito</h3>
              <p className="text-muted-foreground text-sm">Uno o più pagamenti non sono andati a buon fine.</p>
            </div>
          </>
        )}

        <div className="space-y-2 max-w-sm mx-auto text-left">
          {renderStatus(nameA, statusA)}
          {renderStatus(nameB, statusB)}
        </div>

        {!bothPaid && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            {anyFailed ? "Riprova" : "Annulla"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default DualSatispayWaiting;
