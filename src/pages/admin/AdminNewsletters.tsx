import { useAdminAuth } from "@/hooks/use-admin-auth";
import NewsletterManager from "@/components/NewsletterManager";

const AdminNewsletters = () => {
  const { adminPassword } = useAdminAuth();
  if (!adminPassword) return null;
  return <NewsletterManager password={adminPassword} />;
};

export default AdminNewsletters;
