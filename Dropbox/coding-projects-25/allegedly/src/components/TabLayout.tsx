import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Vote, Target, TrendingUp, Calculator } from 'lucide-react';

interface TabItem {
  name: string;
  href: string;
  icon: ReactNode;
}

const tabs: TabItem[] = [
  { name: 'Voting', href: '/voting', icon: <Vote size={20} /> },
  { name: 'Consensus & Bets', href: '/consensus', icon: <Target size={20} /> },
  { name: 'Live Tracking', href: '/live', icon: <TrendingUp size={20} /> },
  { name: 'Settlement', href: '/settlement', icon: <Calculator size={20} /> },
];

export default function TabLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-6xl mx-auto">
        {/* Header with tabs */}
        <header className="pt-6 pb-4 px-4">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Allegedly - NFL Betting Group
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              Coordinate picks, track bets, and settle up
            </p>
          </div>

          {/* Tab Navigation */}
          <nav className="flex flex-wrap justify-center gap-2 mb-6">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }
                  `}
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </nav>
        </header>

        {/* Page content */}
        <main className="px-4 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}