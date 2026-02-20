import { Link, useLocation } from "react-router-dom";
import { Home, FolderOpen, Settings } from "lucide-react";
import { useAuth } from "@/App";

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  // Hide on landing, auth pages, and reader page (reader has own controls)
  if (!user || location.pathname.startsWith('/reader')) return null;

  const navItems = [
    { path: "/dashboard", icon: Home, label: "Home" },
    { path: "/dashboard", icon: FolderOpen, label: "Projects", match: "/project" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (item) => {
    if (item.match && location.pathname.startsWith(item.match)) return true;
    return location.pathname === item.path;
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden app-bottom-controls"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-14 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all app-btn relative ${
                active 
                  ? "text-purple-400" 
                  : "text-muted-foreground"
              }`}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Icon className={`w-6 h-6 transition-transform ${active ? "scale-110" : ""}`} />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
              {active && (
                <div className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
