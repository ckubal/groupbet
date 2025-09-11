import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Target, TrendingUp, Calculator, Zap } from 'lucide-react';

interface TabItem {
  name: string;
  href: string;
  icon: ReactNode;
}

const tabs: TabItem[] = [
  { name: 'study', href: '/voting', icon: <Search size={18} /> },
  { name: 'alignment & bets', href: '/consensus', icon: <Target size={18} /> },
  { name: 'live tracking', href: '/live', icon: <TrendingUp size={18} /> },
  { name: 'settlement', href: '/settlement', icon: <Calculator size={18} /> },
];

export default function TabLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
  // Extract group ID from URL if present
  const groupMatch = pathname.match(/\/group\/([^\/]+)/);
  const groupId = groupMatch ? groupMatch[1] : null;
  const basePath = groupId ? `/group/${groupId}` : '';

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header with tabs */}
        <header className="pt-6 sm:pt-8 pb-4 sm:pb-6">
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-2 sm:p-3 rounded-2xl glass border border-accent-blue/30 glow-blue">
                <Zap size={20} className="text-accent-blue sm:w-6 sm:h-6" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                allegedly
              </h1>
            </div>
            <p className="text-gray-400 text-xs sm:text-sm tracking-wide px-4">
              nfl betting coordination • futuristic insights • group intelligence
            </p>
          </div>

          {/* Tab Navigation */}
          <nav className="flex justify-center mb-8 sm:mb-12">
            <div className="glass rounded-3xl p-1 sm:p-2 backdrop-blur-2xl border border-white/10 w-full max-w-4xl overflow-x-auto">
              <div className="flex gap-1 min-w-max sm:min-w-0">
                {tabs.map((tab, index) => {
                  const fullHref = `${basePath}${tab.href}`;
                  const isActive = pathname === fullHref || pathname === tab.href;
                  const colors = ['accent-blue', 'accent-green', 'accent-purple', 'accent-pink'];
                  const color = colors[index % colors.length];
                  
                  return (
                    <Link
                      key={tab.href}
                      href={fullHref}
                      className={`
                        flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 rounded-2xl font-medium transition-all interactive whitespace-nowrap
                        ${isActive 
                          ? `glass border border-${color}/30 text-${color} shadow-lg` 
                          : 'text-gray-300 hover:text-white hover:bg-white/5'
                        }
                      `}
                    >
                      <div className={isActive ? `text-${color}` : 'text-gray-400'}>
                        {tab.icon}
                      </div>
                      <span className="text-xs sm:text-sm font-semibold tracking-wide">{tab.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </header>

        {/* Page content */}
        <main className="pb-24 sm:pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}