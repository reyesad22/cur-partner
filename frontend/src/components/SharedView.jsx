import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Mic,
  Play,
  Clock,
  Eye,
  Calendar,
  User,
  AlertCircle,
  Loader2
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const SharedView = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchSharedTake();
  }, [token]);

  const fetchSharedTake = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/shared/${token}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to load");
      }
      const data = await response.json();
      setData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">
            {error === "Share link has expired" ? "Link Expired" : "Not Found"}
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link to="/">
            <Button className="btn-primary">Go to CuePartner</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="shared-view-page">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold">CuePartner</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Video Info */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{data.project_title}</h1>
          {data.recipient_name && (
            <p className="text-muted-foreground">
              Shared with: {data.recipient_name}
            </p>
          )}
          {data.message && (
            <div className="mt-4 p-4 rounded-xl bg-secondary">
              <p className="text-sm text-muted-foreground mb-1">Message:</p>
              <p>{data.message}</p>
            </div>
          )}
        </div>

        {/* Video Player */}
        <div className="rounded-2xl overflow-hidden bg-black mb-6">
          <video
            src={data.take.video_url}
            controls
            autoPlay
            className="w-full aspect-video"
            data-testid="shared-video"
          />
        </div>

        {/* Take Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="feature-card p-4 text-center">
            <Play className="w-5 h-5 text-purple-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Take</p>
            <p className="font-semibold">#{data.take.take_number}</p>
          </div>
          <div className="feature-card p-4 text-center">
            <Clock className="w-5 h-5 text-pink-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Duration</p>
            <p className="font-semibold">{formatTime(data.take.duration)}</p>
          </div>
          <div className="feature-card p-4 text-center">
            <Eye className="w-5 h-5 text-blue-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Views</p>
            <p className="font-semibold">{data.views}</p>
          </div>
          <div className="feature-card p-4 text-center">
            <Calendar className="w-5 h-5 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Expires</p>
            <p className="font-semibold text-sm">
              {new Date(data.expires_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Notes */}
        {data.take.notes && (
          <div className="mt-6 p-4 rounded-xl bg-secondary">
            <p className="text-sm text-muted-foreground mb-1">Actor's Notes:</p>
            <p>{data.take.notes}</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-muted-foreground mb-4">
            Want to create your own self-tapes with AI-powered scene partners?
          </p>
          <Link to="/signup">
            <Button className="btn-primary">Try CuePartner Free</Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Powered by CuePartner - Never Miss an Audition</p>
        </div>
      </footer>
    </div>
  );
};

export default SharedView;
