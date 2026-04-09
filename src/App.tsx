import { lazy, Suspense, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import {
  Cpu,
  ArrowRightLeft,
  ShieldCheck,
  Database,
  ChevronDown,
  Sparkles,
  Boxes,
  Clock3,
} from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { loginWithGoogle } from './firebase';
import provioLogo from './Glowing leaf circle on dark background.png';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const SmartIntake = lazy(() => import('./pages/SmartIntake'));
const Transfers = lazy(() => import('./pages/Transfers'));
const Checkpoints = lazy(() => import('./pages/Checkpoints'));
const Invoices = lazy(() => import('./pages/Invoices'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));

const capabilityCards = [
  {
    title: 'Smart Intake',
    description:
      'Parse volunteer notes, pickup summaries, and donation descriptions into structured inventory records in one step.',
    icon: Cpu,
    accent: 'bg-vt-maroon text-vt-cream',
  },
  {
    title: 'Cross-Program Logistics',
    description:
      'Track movements between pantry and grocery flows so availability stays visible during high-volume service windows.',
    icon: ArrowRightLeft,
    accent: 'bg-vt-orange text-vt-ink',
  },
  {
    title: 'Baseline Auditing',
    description:
      'Capture immutable checkpoints for reporting, reconciliation, and volunteer handoffs without manual spreadsheets.',
    icon: Database,
    accent: 'bg-vt-ink text-vt-cream',
  },
];

const impactStats = [
  { label: 'Manual Steps Removed', value: '3x', icon: Sparkles },
  { label: 'Inventory Views', value: 'Live', icon: Boxes },
  { label: 'Checkpoint Creation', value: '<1m', icon: Clock3 },
];

function Login() {
  const [loginError, setLoginError] = useState('');

  const scrollToInfo = () => {
    document.getElementById('system-info')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogin = async () => {
    setLoginError('');

    try {
      await loginWithGoogle();
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

      if (code === 'auth/popup-blocked') {
        setLoginError('Popup blocked. Allow popups for this site and try again.');
        return;
      }

      if (code === 'auth/unauthorized-domain') {
        setLoginError('This domain is not authorized in Firebase Auth. Use localhost or add the current host in Firebase console.');
        return;
      }

      if (code === 'auth/operation-not-allowed') {
        setLoginError('Google sign-in is not enabled for this Firebase project.');
        return;
      }

      if (code === 'auth/popup-closed-by-user') {
        setLoginError('Google sign-in popup was closed before completing login.');
        return;
      }

      setLoginError('Google sign-in failed. Check Firebase Auth setup and browser console for details.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-vt-cream">
      <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative retro-grid">
        <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 border-4 border-vt-ink rounded-xl overflow-hidden shadow-[12px_12px_0px_0px_#861F41] bg-vt-cream transition-all z-10">
          <div className="bg-vt-orange p-10 md:p-16 flex flex-col justify-between border-b-4 md:border-b-0 md:border-r-4 border-vt-ink relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-vt-maroon rounded-full mix-blend-multiply opacity-50 blur-2xl" />

            <div className="relative z-10">
              <div className="inline-block border-4 border-vt-ink bg-vt-cream px-4 py-2 mb-8 -rotate-2 shadow-[4px_4px_0px_0px_#1A1516]">
                <span className="font-mono font-bold text-vt-ink tracking-widest uppercase">System v1.0</span>
              </div>
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 md:h-24 md:w-24 border-4 border-vt-ink rounded-full overflow-hidden bg-vt-maroon shadow-[6px_6px_0px_0px_#1A1516] shrink-0">
                  <img src={provioLogo} alt="Provio logo" className="h-full w-full scale-125 object-cover" />
                </div>
                <h1 className="font-serif text-6xl md:text-7xl font-bold text-vt-ink leading-none tracking-tight">
                  PROVIO<span className="text-vt-maroon">.</span>
                </h1>
              </div>
            </div>

            <div className="mt-16 relative z-10">
              <p className="font-mono text-vt-ink font-bold uppercase tracking-widest border-t-4 border-vt-ink pt-6">
                VT Food Pantry
              </p>
              <p className="font-sans text-vt-ink text-xl md:text-2xl mt-3 font-semibold">
                AI-assisted operating system for intake, transfers, and audit-ready stock visibility.
              </p>
            </div>
          </div>

          <div className="p-10 md:p-16 flex flex-col justify-center items-center text-center bg-vt-cream relative">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4 text-vt-ink">Authorized Access</h2>
            <p className="font-sans text-gray-600 mb-6 max-w-sm">
              Replace clipboard workflows with a single volunteer terminal for donation intake, stock routing, and checkpoint history.
            </p>

            <div className="w-full max-w-sm grid grid-cols-3 gap-3 mb-10">
              {impactStats.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="border-4 border-vt-ink bg-vt-cream px-3 py-4 shadow-[4px_4px_0px_0px_#E87722]"
                >
                  <Icon size={18} className="mx-auto mb-2 text-vt-maroon" />
                  <p className="font-mono text-lg font-bold uppercase text-vt-ink">{value}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleLogin}
              className="w-full max-w-sm bg-vt-maroon text-vt-cream border-4 border-vt-ink py-4 px-6 font-mono font-bold text-lg hover:bg-vt-maroon-dark active:translate-y-2 active:shadow-none shadow-[8px_8px_0px_0px_#1A1516] transition-all flex items-center justify-center gap-3"
            >
              LOG IN WITH GOOGLE
            </button>
            {loginError ? (
              <div className="w-full max-w-sm mt-4 border-4 border-vt-ink bg-red-200 text-vt-ink px-4 py-3 text-left shadow-[4px_4px_0px_0px_#861F41]">
                <p className="font-mono text-xs font-bold uppercase tracking-widest mb-1">Auth Error</p>
                <p className="font-sans text-sm font-medium">{loginError}</p>
              </div>
            ) : null}
          </div>
        </div>

        <button
          onClick={scrollToInfo}
          className="absolute bottom-8 animate-bounce bg-vt-ink text-vt-cream p-3 border-4 border-vt-ink shadow-[4px_4px_0px_0px_#861F41] hover:-translate-y-1 transition-transform z-10"
        >
          <ChevronDown size={32} />
        </button>
      </div>

      <div id="system-info" className="bg-vt-ink text-vt-cream py-24 px-4 md:px-8 border-t-8 border-vt-maroon">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 border-b-4 border-vt-cream pb-6 inline-block">
            <h2 className="font-serif text-5xl font-bold uppercase tracking-tight">System Capabilities</h2>
            <p className="font-mono text-vt-orange mt-3 text-xl uppercase tracking-widest">Core Modules</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {capabilityCards.map(({ title, description, icon: Icon, accent }) => (
              <div
                key={title}
                className="bg-vt-cream text-vt-ink border-4 border-vt-cream p-8 shadow-[8px_8px_0px_0px_#E87722] hover:-translate-y-2 transition-transform"
              >
                <div className={`w-16 h-16 border-4 border-vt-ink flex items-center justify-center mb-6 ${accent}`}>
                  <Icon size={32} />
                </div>
                <h3 className="font-serif text-2xl font-bold uppercase mb-4">{title}</h3>
                <p className="font-sans text-gray-700 font-medium">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-vt-maroon text-vt-cream py-24 px-4 md:px-8 border-t-8 border-vt-orange">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="flex-1">
            <div className="inline-block border-4 border-vt-cream bg-vt-ink px-4 py-2 mb-8 shadow-[4px_4px_0px_0px_#E87722]">
              <span className="font-mono font-bold text-vt-cream tracking-widest uppercase">Operation Protocol</span>
            </div>
            <h2 className="font-serif text-5xl md:text-6xl font-bold uppercase tracking-tight mb-8 leading-tight">
              Streamlining Food Distribution.
            </h2>
            <p className="font-sans text-xl md:text-2xl font-medium opacity-90 leading-relaxed mb-8">
              PROVIO gives volunteers a shared source of truth during fast-moving donation and distribution cycles. Instead of re-entering the same inventory facts across notes, memory, and spreadsheets, teams can intake, transfer, and audit in one place.
            </p>
            <div className="flex items-center gap-4 font-mono font-bold uppercase tracking-widest text-vt-orange border-l-4 border-vt-orange pl-4">
              <ShieldCheck size={24} />
              <span>Secure, Fast, Demo-Ready Operations</span>
            </div>
          </div>

          <div className="flex-1 w-full relative">
            <div className="absolute inset-0 bg-vt-ink translate-x-4 translate-y-4 border-4 border-vt-ink" />
            <div className="relative bg-vt-cream border-4 border-vt-ink p-8">
              <div className="flex items-center justify-between border-b-4 border-vt-ink pb-4 mb-6">
                <span className="font-mono font-bold text-vt-ink uppercase tracking-widest">System Status</span>
                <span className="w-4 h-4 bg-green-500 rounded-full border-2 border-vt-ink animate-pulse" />
              </div>
              <div className="space-y-4 font-mono text-sm text-vt-ink font-bold">
                <div className="flex justify-between"><span>DATABASE:</span><span className="text-green-600">ONLINE</span></div>
                <div className="flex justify-between"><span>AI PARSER:</span><span className="text-green-600">READY</span></div>
                <div className="flex justify-between"><span>AUTH NODE:</span><span className="text-green-600">ACTIVE</span></div>
                <div className="flex justify-between pt-4 border-t-2 border-vt-ink/20"><span>LATENCY:</span><span>12ms</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-vt-cream text-vt-ink py-12 border-t-8 border-vt-ink text-center">
        <div className="max-w-5xl mx-auto px-4 flex flex-col items-center">
          <img src={provioLogo} alt="Provio logo" className="mb-6 h-12 w-12 rounded-full border-2 border-vt-ink object-cover" />
          <p className="font-mono font-bold uppercase tracking-widest text-lg mb-2">PROVIO Terminal</p>
          <p className="font-sans font-medium text-gray-600">Virginia Tech Food Pantry Operations</p>
          <div className="mt-8 pt-8 border-t-4 border-vt-ink/20 w-full max-w-md">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-gray-500">
              v1.0.0 // Intake, Transfers, Checkpoints
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vt-cream">
        <div className="font-mono text-2xl font-bold animate-pulse text-vt-maroon">INITIALIZING...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Router>
      <Layout>
        <Suspense
          fallback={
            <div className="min-h-[50vh] flex items-center justify-center">
              <div className="font-mono text-xl font-bold uppercase tracking-widest text-vt-maroon">Loading module...</div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/intake" element={<SmartIntake />} />
            <Route path="/transfers" element={<Transfers />} />
            <Route path="/checkpoints" element={<Checkpoints />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/activity" element={<ActivityLog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}
