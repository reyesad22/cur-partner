import { Link } from "react-router-dom";
import { useAuth } from "@/App";
import { 
  Mic, 
  Monitor, 
  Video, 
  Users, 
  DollarSign, 
  Shield,
  ChevronRight,
  Play,
  Upload,
  Sparkles,
  Heart,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const LandingPage = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: <Mic className="w-6 h-6" />,
      title: "Voice-Based Cue Detection",
      description: "Listens as you speak and automatically plays the next cue. Adjustable timing for perfect flow."
    },
    {
      icon: <Monitor className="w-6 h-6" />,
      title: "Voice-Tracked Teleprompter",
      description: "Follows your speech in real-time. Large text, mirrored mode, and perfect sync."
    },
    {
      icon: <Video className="w-6 h-6" />,
      title: "Pro Recording Tools",
      description: "Camera or audio-only mode, countdown slate, multiple takes, and instant export."
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: "Vetted Voice Actors",
      description: "Identity-verified, ownership-declared, admin-approved. Zero AI scraping."
    },
    {
      icon: <DollarSign className="w-6 h-6" />,
      title: "70% to Creators",
      description: "Industry-leading revenue split. Automatic monthly payouts. Fair compensation."
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Ethical AI Use",
      description: "Rehearsal only. No ads, no narration, no training other models. Period."
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Upload Script",
      description: "Auto-detects characters and dialogue from your PDF"
    },
    {
      number: "02",
      title: "Choose Voice",
      description: "Pick the perfect voice actor from our vetted marketplace"
    },
    {
      number: "03",
      title: "Rehearse",
      description: "Practice with voice-based cues and smart teleprompter"
    },
    {
      number: "04",
      title: "Record",
      description: "Capture your best take and export for submission"
    }
  ];

  const voices = [
    { name: "Jessica Martinez", age: 24, gender: "Female", country: "US", tags: "Young Adult • Drama" },
    { name: "Marcus Williams", age: 45, gender: "Male", country: "GB", tags: "Authority • Classic" },
    { name: "Sofia Chen", age: 17, gender: "Female", country: "US", tags: "Teen • Energetic" },
    { name: "James O'Brien", age: 56, gender: "Male", country: "AU", tags: "Character • Warm" }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="landing-page">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2" data-testid="logo">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <span className="font-semibold text-lg">CuePartner</span>
            </Link>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">Features</a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition">How it Works</a>
              <a href="#voices" className="text-sm text-muted-foreground hover:text-foreground transition">Voices</a>
              {user ? (
                <Link to="/dashboard">
                  <Button className="btn-primary" data-testid="dashboard-btn">Dashboard</Button>
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <Link to="/login">
                    <Button variant="ghost" className="text-sm" data-testid="login-btn">Log in</Button>
                  </Link>
                  <Link to="/signup">
                    <Button className="btn-primary" data-testid="signup-btn">Start Free</Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="mobile-menu-btn"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden glass border-t border-border">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground">Features</a>
              <a href="#how-it-works" className="block text-sm text-muted-foreground hover:text-foreground">How it Works</a>
              <a href="#voices" className="block text-sm text-muted-foreground hover:text-foreground">Voices</a>
              {user ? (
                <Link to="/dashboard">
                  <Button className="btn-primary w-full" data-testid="mobile-dashboard-btn">Dashboard</Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/login">
                    <Button variant="ghost" className="w-full" data-testid="mobile-login-btn">Log in</Button>
                  </Link>
                  <Link to="/signup">
                    <Button className="btn-primary w-full" data-testid="mobile-signup-btn">Start Free</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 gradient-bg opacity-50" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 text-sm">
            <span className="text-purple-400">Human Voice</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-pink-400">Creator Paid</span>
          </div>
          
          <p className="text-sm sm:text-base font-medium tracking-widest text-purple-300 uppercase mb-4">
            Never Miss an Audition
          </p>
          
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6 leading-tight" data-testid="hero-title">
            Rehearse Like <br />
            <span className="gradient-text">A Professional</span>
          </h1>
          
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Voice-powered cue reader and teleprompter for actors who care about their craft—
            and the people who help them succeed
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup">
              <Button className="btn-primary text-lg px-8 py-6" data-testid="hero-start-btn">
                Start Free <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="#voices">
              <Button variant="ghost" className="btn-secondary text-lg px-8 py-6" data-testid="hero-browse-btn">
                Browse Voices
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-purple-400 text-sm font-medium mb-3">Everything you need</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built by actors, for actors</h2>
            <p className="text-muted-foreground">Professional tools that understand your workflow</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card" data-testid={`feature-card-${index}`}>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4 text-purple-400">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 gradient-bg">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-pink-400 text-sm font-medium mb-3">Script to perfect take</p>
            <h2 className="text-3xl sm:text-4xl font-bold">In four simple steps</h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8" data-testid="steps-grid">
            {steps.map((step, index) => (
              <div key={index} className="text-center" data-testid={`step-${index}`}>
                <div className="step-number mb-4">{step.number}</div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Library */}
      <section id="voices" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-purple-400 text-sm font-medium mb-3">Voice Library</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Meet Your Reader</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              AI-powered voice selection finds the perfect scene partner for your script. 
              Every voice reads with emotion, not like a robot.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12" data-testid="voices-grid">
            {voices.map((voice, index) => (
              <div key={index} className="voice-card" data-testid={`voice-card-${index}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold text-sm">
                    {voice.country}
                  </div>
                  <div>
                    <h4 className="font-medium">{voice.name}</h4>
                    <p className="text-xs text-muted-foreground">{voice.age} years • {voice.gender}</p>
                  </div>
                </div>
                <p className="text-sm text-purple-400">{voice.tags}</p>
                <button className="mt-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
                  <Play className="w-4 h-4" /> Listen
                </button>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="feature-card">
              <Sparkles className="w-8 h-8 text-purple-400 mb-4" />
              <h3 className="font-semibold mb-2">Smart Matching</h3>
              <p className="text-sm text-muted-foreground">
                AI analyzes your script and automatically selects the perfect voice for each character
              </p>
            </div>
            <div className="feature-card">
              <Heart className="w-8 h-8 text-pink-400 mb-4" />
              <h3 className="font-semibold mb-2">Emotional Reading</h3>
              <p className="text-sm text-muted-foreground">
                Voices adapt to the scene's emotion—anger, joy, sadness—for authentic rehearsal
              </p>
            </div>
            <div className="feature-card">
              <Users className="w-8 h-8 text-purple-400 mb-4" />
              <h3 className="font-semibold mb-2">Diverse Library</h3>
              <p className="text-sm text-muted-foreground">
                100+ verified voice actors across all ages, genders, and accents
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Promise Section */}
      <section className="py-20 px-4 gradient-bg">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-pink-400 text-sm font-medium mb-3">Our Promise</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Supporting performers, <br />
            <span className="gradient-text">not replacing them</span>
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Every time you use a voice from our marketplace, a real performer gets paid. 
            We believe AI should empower artists, not exploit them.
          </p>
          
          <div className="flex flex-wrap justify-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <span className="text-sm">Human voices only</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <span className="text-sm">Fair compensation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <span className="text-sm">Transparent payouts</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to level up?</h2>
          <p className="text-muted-foreground mb-8">Join thousands of actors rehearsing smarter</p>
          <Link to="/signup">
            <Button className="btn-primary text-lg px-8 py-6" data-testid="cta-start-btn">
              Get Started Free <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">CuePartner</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CuePartner. Supporting performers, not replacing them.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
