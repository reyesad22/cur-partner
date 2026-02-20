import { useAuth } from "@/App";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Mic,
  User,
  LogOut,
  ChevronRight,
  Bell,
  HelpCircle,
  Shield,
  Moon,
  ArrowLeft
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const menuItems = [
    { icon: Bell, label: "Notifications", action: "toggle", state: notifications, setState: setNotifications },
    { icon: Moon, label: "Dark Mode", action: "toggle", state: true, disabled: true },
    { icon: HelpCircle, label: "Help & Support", action: "link" },
    { icon: Shield, label: "Privacy Policy", action: "link" },
  ];

  return (
    <div className="min-h-screen bg-background has-bottom-nav page-transition" data-testid="settings-page">
      {/* Header */}
      <header className="app-header border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="text-muted-foreground md:hidden">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-semibold">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 app-scroll">
        {/* Profile Card */}
        <div className="feature-card app-card mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-lg truncate">{user?.name}</h2>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 app-list-item"
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.action === "toggle" ? (
                <Switch
                  checked={item.state}
                  onCheckedChange={item.setState}
                  disabled={item.disabled}
                />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        {/* Logout Button */}
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start p-4 h-auto text-red-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl app-btn"
          data-testid="settings-logout-btn"
        >
          <LogOut className="w-5 h-5 mr-3" />
          <span className="font-medium">Log Out</span>
        </Button>

        {/* App Info */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold">CuePartner</span>
          </div>
          <p className="text-xs text-muted-foreground">Version 1.0.0</p>
          <p className="text-xs text-muted-foreground mt-1">Never Miss an Audition</p>
        </div>
      </main>
    </div>
  );
};

export default Settings;
