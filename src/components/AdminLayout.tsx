import { Navigate, Outlet, useLocation, Link, NavLink } from "react-router-dom";
import { Loader2, LogOut, CalendarDays, Users, Smartphone, FileCheck, Mail, Upload, LayoutDashboard, Building2 } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import ThemeSelector from "@/components/ThemeSelector";
import { useAdminAuth } from "@/hooks/use-admin-auth";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/events", label: "Eventi", icon: CalendarDays },
  { to: "/admin/users", label: "Utenti", icon: Users },
  { to: "/admin/societa", label: "Società", icon: Building2 },
  { to: "/admin/satispay", label: "Satispay", icon: Smartphone },
  { to: "/admin/certificates", label: "Certificati", icon: FileCheck },
  { to: "/admin/newsletters", label: "Newsletter", icon: Mail },
  { to: "/admin/imports", label: "Import", icon: Upload },
];

const AdminSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Backoffice</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2 ${isActive ? "bg-muted text-foreground font-medium" : "hover:bg-muted/50"}`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

const AdminLayout = () => {
  const { loading, isAdmin, email, signOut } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/50 px-3 sm:px-6">
            <SidebarTrigger />
            <Link to="/admin" className="font-display font-bold text-foreground">
              GINEPRO Admin
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <ThemeSelector />
              <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[200px]">
                {email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1.5" />
                Esci
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
