import { useAdminAuth } from "@/hooks/use-admin-auth";
import TransactionalEmailManager from "@/components/TransactionalEmailManager";

const AdminEmails = () => {
  const { adminPassword } = useAdminAuth();
  if (!adminPassword) return null;
  return <TransactionalEmailManager password={adminPassword} />;
};

export default AdminEmails;
