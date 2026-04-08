import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, ArrowRightLeft, Camera, Flag, LogOut } from 'lucide-react';
import { logout } from '../firebase';
import provioLogo from '../Glowing leaf circle on dark background.png';

export default function Layout({ children }: { children: ReactNode }) {
 const location = useLocation();

 const navItems = [
 { name: 'Dashboard', path: '/', icon: LayoutDashboard },
 { name: 'Inventory', path: '/inventory', icon: Package },
 { name: 'Smart Intake', path: '/intake', icon: Camera },
 { name: 'Transfers', path: '/transfers', icon: ArrowRightLeft },
 { name: 'Checkpoints', path: '/checkpoints', icon: Flag },
 ];

 return (
 <div className="min-h-screen flex transition-colors duration-300">
 {/* Sidebar - Brutalist Retro */}
 <aside className="w-72 bg-vt-cream border-r-4 border-vt-ink flex flex-col z-20 shadow-[8px_0px_0px_0px_#861F41] ">
 <div className="p-6 border-b-4 border-vt-ink bg-vt-maroon text-vt-cream ">
 <h1 className="font-serif text-4xl font-bold tracking-tight flex items-center gap-3">
 <img src={provioLogo} alt="Provio logo" className="h-10 w-10 rounded-full border-2 border-vt-cream object-cover" />
 PROVIO
 </h1>
 <p className="font-mono text-xs mt-2 font-bold uppercase tracking-widest border-t-2 border-vt-cream/30 pt-2">
 Terminal Active
 </p>
 </div>
 
 <nav className="flex-1 p-6 space-y-4 overflow-y-auto">
 {navItems.map((item) => {
 const Icon = item.icon;
 const isActive = location.pathname === item.path;
 return (
 <Link
 key={item.name}
 to={item.path}
 className={`flex items-center gap-4 px-4 py-3 font-mono font-bold text-sm uppercase tracking-wider transition-all border-2 ${
 isActive 
 ? 'bg-vt-orange text-vt-ink border-vt-ink shadow-[4px_4px_0px_0px_#1A1516] translate-x-1' 
 : 'bg-transparent text-vt-ink border-transparent hover:border-vt-ink hover:shadow-[4px_4px_0px_0px_#861F41] hover:-translate-y-1'
 }`}
 >
 <Icon size={20} />
 {item.name}
 </Link>
 );
 })}
 </nav>

 <div className="p-6 border-t-4 border-vt-ink bg-vt-cream">
 <button
 onClick={logout}
 className="flex items-center gap-4 px-4 py-3 w-full font-mono font-bold text-sm uppercase tracking-wider transition-all border-2 border-vt-ink bg-vt-orange text-vt-ink shadow-[4px_4px_0px_0px_#861F41] hover:shadow-[4px_4px_0px_0px_#1A1516] hover:-translate-y-1"
 >
 <LogOut size={20} />
 Log Out
 </button>
 </div>
 </aside>

 {/* Main Content */}
 <main className="flex-1 overflow-y-auto relative z-10 retro-grid">
 <div className="p-8 md:p-12 max-w-7xl mx-auto">
 {children}
 </div>
 </main>
 </div>
 );
}
