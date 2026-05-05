import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import AdminChatSidebar from "@/components/AdminChatSidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

const AdminChat = () => {
  const { adminPassword } = useAdminAuth();
  const [open, setOpen] = useState(true);

  if (!adminPassword) return null;

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold">Chat AI</h1>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground mb-4">
            Interroga il database in linguaggio naturale tramite Gemini.
          </p>
          <Button onClick={() => setOpen(true)}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Apri chat
          </Button>
        </CardContent>
      </Card>
      <AdminChatSidebar password={adminPassword} open={open} onClose={() => setOpen(false)} />
    </div>
  );
};

export default AdminChat;
