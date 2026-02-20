import { useState, useEffect } from "react";
import { useAuth, api } from "@/App";
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
  ArrowLeft,
  Crown,
  Cloud,
  Zap,
  Check,
  Loader2
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchMembership();
  }, []);

  const fetchMembership = async () => {
    try {
      const response = await api.get("/membership/status");
      setMembership(response.data);
    } catch (error) {
      console.error("Failed to fetch membership:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      // In production, this would redirect to Stripe checkout
      const response = await api.post("/membership/upgrade?tier=pro");
      setMembership(prev => ({
        ...prev,
        membership: response.data.membership
      }));
      toast.success("Welcome to Pro! Enjoy cloud storage and more.");
    } catch (error) {
      toast.error("Failed to upgrade");
    } finally {
      setUpgrading(false);
    }
  };

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

  const isPro = membership?.membership?.tier === "pro";

  const proFeatures = [
    "Unlimited cloud storage",
    "Unlimited takes per project",
    "Direct submission to casting",
    "Shareable links",
    "Priority support",
    "Advanced AI analysis"
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
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg truncate">{user?.name}</h2>
                {isPro && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium">
                    PRO
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* Membership Card */}
        <div className="feature-card app-card mb-6 overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <Crown className={`w-5 h-5 ${isPro ? 'text-yellow-400' : 'text-muted-foreground'}`} />
            <h3 className="font-semibold">Membership</h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : isPro ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="text-green-400 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">Cloud Storage</span>
                <span>
                  {membership.membership.cloud_storage_used_mb?.toFixed(1) || 0} / {membership.membership.cloud_storage_limit_mb} MB
                </span>
              </div>
              {membership.membership.expires_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Renews</span>
                  <span>{new Date(membership.membership.expires_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                You're on the <strong>Free</strong> plan. Upgrade to Pro for cloud storage and more.
              </p>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-400" />
                  Pro Features
                </h4>
                <ul className="space-y-2">
                  {proFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {upgrading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Pro - $9.99/mo
                  </>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Cancel anytime. 7-day free trial.
              </p>
            </div>
          )}
        </div>

        {/* Storage Info (Pro) */}
        {isPro && (
          <div className="feature-card app-card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Cloud className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Cloud Storage</h3>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ 
                  width: `${(membership.membership.cloud_storage_used_mb / membership.membership.cloud_storage_limit_mb) * 100}%` 
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {membership.membership.cloud_storage_used_mb?.toFixed(1) || 0} MB of {membership.membership.cloud_storage_limit_mb} MB used
            </p>
          </div>
        )}

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
          <p className="text-xs text-muted-foreground">Version 2.0.0</p>
          <p className="text-xs text-muted-foreground mt-1">Never Miss an Audition</p>
        </div>
      </main>
    </div>
  );
};

export default Settings;
