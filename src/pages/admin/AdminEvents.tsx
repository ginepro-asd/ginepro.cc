import { useAdminAuth } from "@/hooks/use-admin-auth";
import EventManager from "@/components/EventManager";

const AdminEvents = () => {
  const { adminPassword } = useAdminAuth();
  if (!adminPassword) return null;
  return <EventManager password={adminPassword} />;
};

export default AdminEvents;
