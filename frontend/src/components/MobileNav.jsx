import { Link, useLocation } from "react-router-dom";
import { Home, FolderOpen, Mic, User } from "lucide-react";
import { useAuth } from "@/App";

const MobileNav = () => {
  const location = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const navItems = [
    { path: "/dashboard", icon: Home, label: "Home" },
    { path: "/dashboard", icon: FolderOpen, label: "Projects", match: "/project" },
    { path: "/dashboard", icon: Mic, label: "Reader", match: "/reader" },
  ];

  const isActive = (item) => {
    if (item.match && location.pathname.startsWith(item.match)) return true;
    return location.pathname === item.path;
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border safe-area-bottom"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          
          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                active 
                  ? "text-purple-400" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <Icon className={`w-6 h-6 ${active ? "scale-110" : ""} transition-transform`} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
              {active && (
                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-purple-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
