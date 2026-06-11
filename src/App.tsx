import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Individual, Marriage } from '@/types';
import { MOCK_INDIVIDUALS, MOCK_MARRIAGES } from '@/lib/mockData';
import FamilyTree from '@/components/Tree/FamilyTree';
import IndividualDetail from '@/components/Sidebar/IndividualDetail';
import LoginPage from '@/components/Auth/LoginPage';
import AdminPanel from '@/components/Admin/AdminPanel';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { generateGenealogyIDs, calculateGenerations } from '@/lib/genealogy';
import { LembagaProfile } from '@/components/Admin/LembagaProfile';
import { RelationshipSearch } from '@/components/Sidebar/RelationshipSearch';
import { 
  Search, 
  Filter, 
  Share2, 
  Settings, 
  Users, 
  LogIn, 
  LogOut, 
  ShieldCheck, 
  UserPlus, 
  RefreshCcw, 
  Calendar,
  Menu,
  BarChart3,
  X as CloseIcon,
  PhoneCall,
  ArrowRightLeft
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-rose-50 text-rose-800 font-sans">
          <h1 className="text-2xl font-bold mb-4">Aplikasi Mengalami Kendala</h1>
          <pre className="p-4 bg-white border border-rose-200 rounded text-xs overflow-auto">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded font-bold"
          >
            Muat Ulang Halaman
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [individuals, setIndividuals] = useState<Individual[]>(MOCK_INDIVIDUALS);
  const [marriages, setMarriages] = useState<Marriage[]>(MOCK_MARRIAGES);
  const [selectedIndividual, setSelectedIndividual] = useState<Individual | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isLembagaOpen, setIsLembagaOpen] = useState(false);
  const [isRelationshipSearchOpen, setIsRelationshipSearchOpen] = useState(false);
  const [adminTargetIndividual, setAdminTargetIndividual] = useState<Individual | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [selectedGen, setSelectedGen] = useState<number | null>(null);
  const [selectedLoc, setSelectedLoc] = useState<string | null>(null);
  const [lifeStatusFilter, setLifeStatusFilter] = useState<'all' | 'alive' | 'deceased'>('all');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [economicStatusFilter, setEconomicStatusFilter] = useState<'all' | 'Kaya' | 'Menengah' | 'Miskin'>('all');
  
  const [searchResults, setSearchResults] = useState<(Individual & { displayId: string })[]>([]);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Memoize levels, ranks and shortestPaths to avoid redundant heavy calculations
  const genMetadata = React.useMemo(() => {
    if (!individuals.length) return { levels: {}, ranks: {}, shortestPaths: {} };
    return calculateGenerations(individuals, marriages);
  }, [individuals, marriages]);

  // Individual from URL
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '') {
      setSelectedIndividual(null);
      return;
    }
    
    // Extract potential ID/Slug from /851 or /G1 or /uuid
    const segments = path.split('/').filter(Boolean);
    if (segments.length > 0) {
      const slug = segments[segments.length - 1]; // Use last segment as slug
      
      // 1. Direct ID match
      const foundById = individuals.find(i => i.id === slug);
      if (foundById) {
        setSelectedIndividual(foundById);
        return;
      }

      // 2. Alphanumeric/BaseId match (Calculated)
      // We need to check all individuals' calculated IDs
      const { levels, ranks, shortestPaths } = genMetadata;
      for (const ind of individuals) {
        const { displayId, baseId } = generateGenealogyIDs(ind, individuals, marriages, levels, ranks, shortestPaths, true);
        if (
          displayId.toLowerCase() === slug.toLowerCase() || 
          baseId.toLowerCase() === slug.toLowerCase() ||
          displayId.toLowerCase().replace(/[g.]/g, '') === slug.toLowerCase() || // Allow '851' for 'G8.5.1' or similar
          (ind as any).slug === slug
        ) {
          setSelectedIndividual(ind);
          return;
        }
      }

      // 3. Name slug match (fallback)
      const nameSlug = slug.toLowerCase().replace(/\s+/g, '-');
      const foundByNameSlug = individuals.find(i => 
        i.name && i.name.toLowerCase().replace(/\s+/g, '-') === nameSlug
      );
      if (foundByNameSlug) {
        setSelectedIndividual(foundByNameSlug);
      }
    }
  }, [location.pathname, individuals, genMetadata, marriages]);

  // Update URL when individual is selected
  useEffect(() => {
    if (selectedIndividual) {
      const currentPath = location.pathname;
      const targetPath = `/${selectedIndividual.id}`;
      if (currentPath !== targetPath && !currentPath.includes('admin')) {
        navigate(targetPath, { replace: true });
      }
    } else if (location.pathname !== '/' && !location.pathname.includes('admin') && !location.pathname.includes('lembaga')) {
      // navigate('/', { replace: true });
    }
  }, [selectedIndividual, navigate, location.pathname]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchData = async () => {
    try {
      // Fetch Individuals
      const { data: indData, error: indError } = await supabase
        .from('individuals')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (indError) throw indError;
      if (indData) {
        setIndividuals(Array.from(new Map(indData.map(i => [i.id, i])).values()));
      }

      // Fetch Marriages
      const { data: mrgData, error: mrgError } = await supabase
        .from('marriages')
        .select('*');
      
      if (mrgError) {
        console.warn('Marriage table might not exist yet:', mrgError);
      } else if (mrgData) {
        setMarriages(Array.from(new Map(mrgData.map(m => [m.id, m])).values()));
      }
    } catch (err) {
      console.error('Error fetching data, using mock data:', err);
    }
  };

  useEffect(() => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    if (query.length > 1) {
      const results: (Individual & { displayId: string })[] = [];
      
      const pool = individuals || [];
      const { levels, ranks, shortestPaths } = genMetadata;

      for (const ind of pool) {
        if (!ind || !ind.name) continue;
        if (results.length >= 30) break;

        const nameMatches = ind.name.toLowerCase().includes(query);
        let idMatched = false;
        let cachedId = '';

        try {
          // Pass pre-calculated metadata!
          const { displayId } = generateGenealogyIDs(ind, individuals, marriages, levels, ranks, shortestPaths, true);
          cachedId = displayId;
          if (!nameMatches && displayId.toLowerCase().includes(query)) {
            idMatched = true;
          }
        } catch (e) {}

        if (nameMatches || idMatched) {
          if (!results.some(r => r.id === ind.id)) {
            results.push({ ...ind, displayId: cachedId });
          }
        }
      }
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, individuals, marriages, genMetadata]);

  useEffect(() => {
    fetchData();

    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) setIsLoginOpen(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleEditIndividual = (individual: Individual) => {
    setAdminTargetIndividual(individual);
    setIsAdminPanelOpen(true);
  };

  const handleAddNew = () => {
    setAdminTargetIndividual(null);
    setIsAdminPanelOpen(true);
  };

  const toggleStats = () => setIsStatsOpen(!isStatsOpen);

  const stats = React.useMemo(() => {
    const locCounts: Record<string, number> = {};
    const genCounts: Record<number, number> = {};
    let lastUpdate: string | null = null;
    let verifiedCount = 0;
    let unverifiedCount = 0;
    let aliveCount = 0;
    let deceasedCount = 0;

    if (!individuals.length) return { sortedLocs: [], sortedGens: [], lastUpdate: null, verifiedCount: 0, unverifiedCount: 0, aliveCount: 0, deceasedCount: 0 };

    const { levels } = genMetadata;

    individuals.forEach(ind => {
      // Verified status
      if (ind.is_verified) verifiedCount++;
      else unverifiedCount++;

      // Life status
      if (ind.is_alive === false || ind.death_date) {
        deceasedCount++;
      } else {
        aliveCount++;
      }

      // Location logic
      const rawLoc = ind.current_location || ind.death_place;
      const loc = rawLoc?.split(',')[0].trim() || 'Tidak Diketahui';
      locCounts[loc] = (locCounts[loc] || 0) + 1;

      // Generation
      const level = levels[ind.id];
      if (level !== undefined) {
        genCounts[level] = (genCounts[level] || 0) + 1;
      }

      // Last Update
      if (ind.updated_at) {
        if (!lastUpdate || new Date(ind.updated_at) > new Date(lastUpdate)) {
          lastUpdate = ind.updated_at;
        }
      }
    });

    const sortedLocs = Object.entries(locCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const sortedGens = Object.entries(genCounts)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([gen, count]) => ({ gen: parseInt(gen), label: `Gen ${gen}`, count }));

    return { sortedLocs, sortedGens, lastUpdate, verifiedCount, unverifiedCount, aliveCount, deceasedCount };
  }, [individuals]);

  const filteredIndividualsByGen = React.useMemo(() => {
    if (selectedGen === null && selectedLoc === null && lifeStatusFilter === 'all' && verificationFilter === 'all' && economicStatusFilter === 'all') return [];
    
    const { levels } = genMetadata;
    let filtered = [...individuals];

    if (selectedGen !== null) {
      filtered = filtered.filter(ind => levels[ind.id] === selectedGen);
    }

    if (selectedLoc !== null) {
      filtered = filtered.filter(ind => {
        const rawLoc = ind.current_location || ind.death_place;
        return rawLoc?.split(',')[0].trim() === selectedLoc;
      });
    }

    if (lifeStatusFilter === 'alive') {
      filtered = filtered.filter(ind => ind.is_alive !== false && !ind.death_date);
    } else if (lifeStatusFilter === 'deceased') {
      filtered = filtered.filter(ind => ind.is_alive === false || ind.death_date);
    }

    if (verificationFilter === 'verified') {
      filtered = filtered.filter(ind => ind.is_verified);
    } else if (verificationFilter === 'unverified') {
      filtered = filtered.filter(ind => !ind.is_verified);
    }

    if (user && economicStatusFilter !== 'all') {
      filtered = filtered.filter(ind => ind.economic_status === economicStatusFilter);
    }
    
    // Safety deduplication
    return Array.from(new Map(filtered.map(i => [i.id, i])).values());
  }, [individuals, selectedGen, selectedLoc, lifeStatusFilter, verificationFilter, economicStatusFilter, genMetadata, user]);

  const renderSidebar = () => (
    <>
      <div className={cn(
        "fixed inset-0 bg-ink/20 backdrop-blur-sm z-[35] lg:hidden transition-opacity duration-300",
        isStatsOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setIsStatsOpen(false)} />
      
      <div className="flex items-center justify-between lg:hidden mb-2">
        <h2 className="font-serif font-bold text-primary-olive italic">Menu Demografi</h2>
        <button onClick={() => setIsStatsOpen(false)} className="p-1 hover:bg-bg rounded-full">
          <CloseIcon size={18} className="text-ink-light" />
        </button>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-3">Demografi Keturunan</h3>
        <div className="bg-bg p-4 rounded-xl border border-border-olive">
          <p className="text-3xl font-light text-primary-olive leading-none">{individuals.length}</p>
          <p className="text-[12px] text-ink-light mt-1">Total Individu</p>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-3">Status Kehidupan</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => setLifeStatusFilter(lifeStatusFilter === 'alive' ? 'all' : 'alive')}
            className={cn(
              "p-3 rounded-xl border transition-all flex flex-col items-center gap-1",
              lifeStatusFilter === 'alive' ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500" : "bg-bg/40 border-border-olive/20 hover:border-emerald-200"
            )}
          >
            <span className="text-2xl font-light text-emerald-600">{stats.aliveCount}</span>
            <span className="text-[9px] uppercase font-bold text-ink-light">Masih Hidup</span>
          </button>
          <button 
            onClick={() => setLifeStatusFilter(lifeStatusFilter === 'deceased' ? 'all' : 'deceased')}
            className={cn(
              "p-3 rounded-xl border transition-all flex flex-col items-center gap-1",
              lifeStatusFilter === 'deceased' ? "bg-zinc-100 border-zinc-500 ring-1 ring-zinc-500 text-zinc-900" : "bg-bg/40 border-border-olive/20 hover:border-zinc-300"
            )}
          >
            <span className="text-2xl font-light text-zinc-400">{stats.deceasedCount}</span>
            <span className="text-[9px] uppercase font-bold text-ink-light">Wafat</span>
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-3">Sebaran Wilayah (Domisili)</h3>
        <div className="space-y-1">
          {stats.sortedLocs.map((loc) => (
            <button 
              key={loc.name} 
              onClick={() => setSelectedLoc(selectedLoc === loc.name ? null : loc.name)}
              className={cn(
                "w-full flex justify-between text-[12px] p-2 rounded-lg transition-all border",
                selectedLoc === loc.name 
                  ? "bg-primary-olive text-white border-primary-olive shadow-sm" 
                  : "hover:bg-bg border-transparent border-dashed hover:border-border-olive"
              )}
            >
              <span className={selectedLoc === loc.name ? "text-white" : "text-ink"}>{loc.name}</span>
              <span className={cn("font-bold", selectedLoc === loc.name ? "text-white" : "text-primary-olive")}>{loc.count}</span>
            </button>
          ))}
          {stats.sortedLocs.length === 0 && (
            <p className="text-[10px] text-ink-light italic text-center py-2">Data belum tersedia</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-3">Individu per Generasi</h3>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {stats.sortedGens.map((gen) => (
            <button 
              key={gen.gen} 
              onClick={() => setSelectedGen(selectedGen === gen.gen ? null : gen.gen)}
              className={cn(
                "p-2 rounded-lg border transition-all flex justify-between items-center",
                selectedGen === gen.gen ? "bg-primary-olive text-white border-primary-olive shadow-md" : "bg-bg/50 border-border-olive/30 hover:border-primary-olive/50"
              )}
            >
              <span className={cn("text-[10px] font-bold", selectedGen === gen.gen ? "text-white" : "text-ink-light")}>{gen.label}</span>
              <span className={cn("text-[12px] font-bold", selectedGen === gen.gen ? "text-white" : "text-primary-olive")}>{gen.count}</span>
            </button>
          ))}
        </div>

        {(selectedGen !== null || selectedLoc !== null || lifeStatusFilter !== 'all' || verificationFilter !== 'all' || economicStatusFilter !== 'all') && (
          <div className="bg-bg p-3 rounded-lg border border-primary-olive/20 mb-4 animate-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-2">
              <div className="flex flex-col">
                <h4 className="text-[10px] font-bold uppercase text-primary-olive">Hasil Filter</h4>
                <span className="text-[8px] text-ink-light italic">Ditemukan {filteredIndividualsByGen.length} orang</span>
              </div>
              <button 
                onClick={() => { 
                  setSelectedGen(null); 
                  setSelectedLoc(null); 
                  setLifeStatusFilter('all'); 
                  setVerificationFilter('all'); 
                  setEconomicStatusFilter('all');
                }} 
                className="text-[9px] text-rose-500 font-bold uppercase tracking-tighter hover:underline"
              >
                Reset Filter
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredIndividualsByGen.map(ind => (
                <button 
                  key={ind.id} 
                  onClick={() => { 
                    const targetPath = ind.slug || ind.id;
                    setSelectedIndividual(ind); 
                    navigate(`/${targetPath}`); 
                    if (window.innerWidth < 1024) setIsStatsOpen(false); 
                  }}
                  className="w-full text-left p-1.5 hover:bg-white rounded text-[11px] text-ink truncate"
                >
                  {ind.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-4">
          <button 
            onClick={() => setVerificationFilter(verificationFilter === 'verified' ? 'all' : 'verified')}
            className={cn(
              "p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
              verificationFilter === 'verified' ? "bg-verified-green/10 border-verified-green ring-1 ring-verified-green" : "bg-bg/30 border-border-olive/20"
            )}
          >
            <span className="text-[14px] font-bold text-verified-green">{stats.verifiedCount}</span>
            <span className="text-[8px] uppercase tracking-tighter font-bold text-ink-light">Terverifikasi</span>
          </button>
          <button 
            onClick={() => setVerificationFilter(verificationFilter === 'unverified' ? 'all' : 'unverified')}
            className={cn(
              "p-2 rounded-lg border transition-all flex flex-col items-center gap-1",
              verificationFilter === 'unverified' ? "bg-rose-50 border-rose-200 ring-1 ring-rose-200" : "bg-bg/30 border-border-olive/20"
            )}
          >
            <span className="text-[14px] font-bold text-rose-500">{stats.unverifiedCount}</span>
            <span className="text-[8px] uppercase tracking-tighter font-bold text-ink-light">Belum Verif</span>
          </button>
        </div>

        {user && (
          <div className="mb-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-2 italic">Status Ekonomi (Admin)</h3>
            <div className="grid grid-cols-3 gap-1">
              {['Kaya', 'Menengah', 'Miskin'].map(status => (
                <button
                  key={status}
                  onClick={() => setEconomicStatusFilter(economicStatusFilter === status ? 'all' : status as any)}
                  className={cn(
                    "p-1.5 rounded-lg border text-[9px] font-bold transition-all",
                    economicStatusFilter === status ? "bg-primary-olive text-white border-primary-olive" : "bg-bg/30 border-border-olive/30 hover:border-primary-olive/30"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-3 italic">Menu Lembaga</h3>
        <div className="space-y-2">
          <button 
            onClick={() => setIsLembagaOpen(true)}
            className="w-full flex items-center gap-3 p-3 bg-white border border-border-olive rounded-xl shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 bg-primary-olive/10 rounded-lg flex items-center justify-center text-primary-olive group-hover:scale-110 transition-transform">
              <ShieldCheck size={18} />
            </div>
            <span className="text-[12px] font-bold text-ink uppercase tracking-wider">Profil Lembaga</span>
          </button>
          <button 
            onClick={() => setIsRelationshipSearchOpen(true)}
            className="w-full flex items-center gap-3 p-3 bg-white border border-border-olive rounded-xl shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 bg-secondary-rust/10 rounded-lg flex items-center justify-center text-secondary-rust group-hover:scale-110 transition-transform">
              <ArrowRightLeft size={18} />
            </div>
            <span className="text-[12px] font-bold text-ink uppercase tracking-wider">Cek Hubungan</span>
          </button>
          <a 
            href="https://wa.me/628995023222" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 p-3 bg-white border border-border-olive rounded-xl shadow-sm hover:shadow-md transition-all group"
          >
            <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
              <PhoneCall size={18} />
            </div>
            <span className="text-[12px] font-bold text-ink uppercase tracking-wider">Call Center</span>
          </a>
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-ink-light mb-3 italic">Kalender Kelahiran</h3>
        <div className="bg-white border border-border-olive rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[14px] font-serif font-bold text-primary-olive">
              {new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(new Date())}
            </span>
            <Calendar size={14} className="text-accent-tan" />
          </div>
          <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1">
            {individuals
              .filter(i => i.birth_date && new Date(i.birth_date).getMonth() === new Date().getMonth())
              .sort((a, b) => new Date(a.birth_date!).getDate() - new Date(b.birth_date!).getDate())
              .map(ind => (
                <div key={ind.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => { 
                  const targetPath = ind.slug || ind.id;
                  setSelectedIndividual(ind); 
                  navigate(`/${targetPath}`); 
                  setIsStatsOpen(false); 
                }}>
                  <div className="w-8 h-8 rounded-full bg-accent-tan/10 border border-accent-tan/20 flex items-center justify-center text-[10px] font-bold text-primary-olive shrink-0">
                    {new Date(ind.birth_date!).getDate()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-ink truncate group-hover:text-primary-olive transition-colors">{ind.name}</p>
                    <p className="text-[9px] text-ink-light leading-none mt-0.5">HUT ke-{new Date().getFullYear() - new Date(ind.birth_date!).getFullYear()}</p>
                  </div>
                </div>
              ))
            }
            {individuals.filter(i => i.birth_date && new Date(i.birth_date).getMonth() === new Date().getMonth()).length === 0 && (
              <p className="text-[10px] text-ink-light italic text-center py-4">Tidak ada kelahiran di bulan ini</p>
            )}
          </div>
        </div>
      </div>

      {user && (
        <div className="mt-auto pt-6 border-t border-border-olive space-y-3">
          <button 
            onClick={() => { handleAddNew(); setIsStatsOpen(false); }}
            className="w-full py-3 bg-primary-olive/5 border border-primary-olive/20 text-primary-olive rounded-xl text-xs font-bold hover:bg-primary-olive/10 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={14} /> Tambah Anggota Baru
          </button>
          <button 
            onClick={fetchData}
            className="w-full py-3 bg-bg border border-border-olive text-ink-light rounded-xl text-xs font-bold hover:bg-surface transition-all flex items-center justify-center gap-2"
          >
            <RefreshCcw size={14} /> Refresh Data
          </button>
        </div>
      )}
      {stats.lastUpdate && (
        <div className="mt-8 pt-4 border-t border-border-olive/30">
          <p className="text-[9px] text-ink-light uppercase tracking-tighter text-center">
            Pembaruan Terakhir: {new Intl.DateTimeFormat('id-ID', { 
              day: 'numeric', 
              month: 'short', 
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(new Date(stats.lastUpdate))}
          </p>
        </div>
      )}
    </>
  );


  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-bg overflow-hidden text-ink font-sans">
        {/* Header */}
        <header className="h-16 bg-surface border-b border-border-olive flex items-center justify-between px-4 md:px-6 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={toggleStats}
            className="lg:hidden p-2 hover:bg-bg rounded-lg transition-colors text-primary-olive"
          >
            <BarChart3 size={20} />
          </button>
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center overflow-hidden bg-white border border-border-olive/20 shadow-sm">
            <img 
              src="https://drive.google.com/thumbnail?id=1fef9BVeWH_dsPNtk4udPh-MpivNcUiRJ&sz=w100" 
              alt="Logo Qomaruddin" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-primary-olive font-serif font-black text-lg">Q</span>';
              }}
            />
          </div>
          <h1 className="text-base md:text-xl font-serif font-bold italic text-primary-olive truncate max-w-[150px] md:max-w-none">Genealogi Kiai Qomaruddin</h1>
          {user && (
            <div className="hidden sm:flex ml-2 md:ml-4 items-center gap-1.5 px-3 py-1 bg-primary-olive/10 text-primary-olive rounded-full text-[9px] font-bold uppercase tracking-widest border border-primary-olive/20 whitespace-nowrap">
              <ShieldCheck size={10} /> Admin
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-6">
          <div className="relative hidden sm:block">
            <input
              type="text"
              placeholder="Cari keluarga..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-3 pr-8 py-1.5 bg-bg border border-border-olive rounded-full text-[12px] transition-all w-[150px] md:w-[250px] focus:outline-none focus:ring-1 focus:ring-primary-olive"
            />
            
            {/* Search Results Dropdown */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full mt-2 left-0 right-0 bg-white border border-border-olive rounded-xl shadow-xl z-50 py-2 max-h-[300px] overflow-y-auto"
                >
                  {searchResults.map(ind => {
                    return (
                      <button
                        key={ind.id}
                        onClick={() => {
                          setSelectedIndividual(ind);
                          setSearchQuery(ind.name || '');
                          setSearchResults([]);
                        }}
                        className="w-full px-4 py-2 hover:bg-bg flex items-center justify-between group transition-colors text-left"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-[12px] font-bold text-ink truncate group-hover:text-primary-olive">{ind.name || 'Tanpa Nama'}</p>
                          <p className="text-[10px] text-ink-light truncate italic">
                            {ind.father_id ? `bin ${individuals.find(p => p?.id === ind.father_id)?.name || '???'}` : 
                             ind.mother_id ? `binti ${individuals.find(p => p?.id === ind.mother_id)?.name || '???'}` : 
                             'Root'}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[9px] font-mono font-bold bg-accent-tan/20 text-primary-olive px-1.5 py-0.5 rounded border border-accent-tan/30 leading-none">
                            {ind.displayId}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAddNew}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-accent-tan text-primary-olive rounded-full text-xs font-bold transition-all hover:bg-accent-tan/80"
                >
                  <UserPlus size={16} /> Tambah Data
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-rose-50 text-rose-600 rounded-full transition-all"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsLoginOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-primary-olive text-white rounded-full text-[11px] md:text-xs font-bold shadow-lg shadow-primary-olive/20 hover:bg-primary-olive/90 transition-all"
              >
                <LogIn size={16} className="hidden sm:block" /> Login
              </button>
            )}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden p-2 hover:bg-bg rounded-lg transition-colors text-primary-olive"
            >
              <Search size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Supabase Mock Mode Alert Banner */}
      {!isSupabaseConfigured && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between text-[11px] md:text-xs text-amber-800 shrink-0 z-20 gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>
              <strong>Mode Demo Offline:</strong> Aplikasi di Cloudflare menggunakan <em>mock data</em> karena variabel lingkungan Supabase belum dipasang pada dashboard Cloudflare Pages.
            </span>
          </div>
          <div className="text-[10px] md:text-[11px] text-amber-700 bg-amber-100/60 px-2.5 py-1 rounded border border-amber-200/50">
            <strong>Solusi:</strong> Daftarkan <code>VITE_SUPABASE_URL</code> & <code>VITE_SUPABASE_ANON_KEY</code> di <strong>Cloudflare Dashboard &gt; Pages &gt; Settings &gt; Environment variables</strong> lalu lakukan build ulang.
          </div>
        </div>
      )}

      {/* Mobile Search Bar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="sm:hidden bg-surface border-b border-border-olive px-4 py-3 z-20"
          >
            <div className="relative">
              <input
                type="text"
                placeholder="Cari nama keluarga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full pl-4 pr-10 py-2.5 bg-bg border border-border-olive rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-primary-olive"
              />
              <button onClick={() => setIsMobileMenuOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-light">
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Mobile Search Results */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                  {searchResults.map(ind => {
                    return (
                      <button
                        key={ind.id}
                        onClick={() => {
                          setSelectedIndividual(ind);
                          setIsMobileMenuOpen(false);
                          setSearchQuery(ind.name || '');
                          setSearchResults([]);
                        }}
                        className="w-full p-4 bg-bg border border-border-olive rounded-xl flex justify-between items-center"
                      >
                        <div className="text-left flex-1 min-w-0 pr-4">
                          <p className="text-[14px] font-bold text-ink truncate">{ind.name || 'Tanpa Nama'}</p>
                          <p className="text-[11px] text-ink-light italic truncate">
                             {ind.father_id ? `bin ${individuals.find(p => p?.id === ind.father_id)?.name || '???'}` : 
                              ind.mother_id ? `binti ${individuals.find(p => p?.id === ind.mother_id)?.name || '???'}` : 
                              'Root'}
                          </p>
                        </div>
                        <span className="text-[11px] font-mono font-bold bg-primary-olive/10 text-primary-olive px-2 py-1 rounded shrink-0">
                          {ind.displayId}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Areas */}
      <div className="flex-1 flex overflow-hidden relative">
        <Routes>
          <Route path="/" element={
            <div className="flex-1 flex overflow-hidden">
               {/* Sidebar - Stats */}
               <aside className={cn(
                "fixed inset-y-0 left-0 w-[280px] bg-surface border-r border-border-olive p-5 flex flex-col gap-8 overflow-y-auto transition-transform duration-300 ease-in-out z-[40] lg:relative lg:translate-x-0 lg:z-10 bg-white",
                isStatsOpen ? "translate-x-0" : "-translate-x-full"
              )}>
                {/* ... (Existing Sidebar Content - extracted to a function or rendered here) ... */}
                {renderSidebar()}
              </aside>

              <div className="flex-1 bg-bg overflow-y-auto p-6 md:p-8 flex flex-col items-center">
                 <div className="max-w-4xl w-full">
                    <div className="mb-12 text-center">
                       <h2 className="text-3xl md:text-5xl font-serif font-bold italic text-primary-olive mb-4">Eksplorasi Genealogi</h2>
                       <p className="text-ink-light text-lg italic">Menelusuri jejak keturunan Kiai Qomaruddin melalui data yang terverifikasi.</p>
                    </div>

                    <div className="relative mb-12">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-primary-olive/40" size={24} />
                      <input 
                        type="text" 
                        placeholder="Masukkan nama untuk memulai..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-16 pr-6 py-5 bg-white border-2 border-border-olive/30 rounded-3xl text-xl shadow-xl shadow-primary-olive/5 focus:outline-none focus:border-primary-olive transition-all"
                      />
                      {searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-4 bg-white border border-border-olive rounded-3xl shadow-2xl z-50 overflow-hidden py-4">
                           {searchResults.map(ind => (
                             <button 
                                key={ind.id}
                                onClick={() => { 
                                  const targetPath = ind.slug || ind.id;
                                  setSelectedIndividual(ind); 
                                  navigate(`/${targetPath}`); 
                                }}
                                className="w-full px-8 py-4 hover:bg-bg flex items-center justify-between group transition-all"
                             >
                                <div className="text-left">
                                   <p className="text-lg font-bold text-ink group-hover:text-primary-olive">{ind.name}</p>
                                   <p className="text-sm text-ink-light italic">
                                     {ind.father_id ? `bin ${individuals.find(p => p?.id === ind.father_id)?.name || '???'}` : 
                                      ind.mother_id ? `binti ${individuals.find(p => p?.id === ind.mother_id)?.name || '???'}` : 
                                      'Root'}
                                   </p>
                                </div>
                                <span className="text-xs font-mono font-bold bg-primary-olive/10 text-primary-olive px-3 py-1.5 rounded-full">{ind.displayId}</span>
                             </button>
                           ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {/* Featured / Random / Recent People */}
                       {individuals.slice(0, 6).map(ind => (
                         <button 
                           key={ind.id}
                           onClick={() => { 
                             const targetPath = ind.slug || ind.id;
                             setSelectedIndividual(ind); 
                             navigate(`/${targetPath}`); 
                           }}
                           className="bg-white p-5 rounded-2xl border border-border-olive/20 hover:border-primary-olive/50 hover:shadow-lg transition-all text-left flex flex-col gap-2 group"
                         >
                            <span className="text-[10px] font-bold text-primary-olive/60 uppercase tracking-widest">{ind.current_location || 'Sampurnan'}</span>
                            <h4 className="text-base font-bold text-ink group-hover:text-primary-olive">{ind.name}</h4>
                            <div className="flex justify-between items-center mt-2">
                               <span className="text-[9px] font-mono bg-bg px-2 py-1 rounded">{(generateGenealogyIDs(ind, individuals, marriages, genMetadata.levels, genMetadata.ranks, genMetadata.shortestPaths, true)).displayId}</span>
                               <ArrowRightLeft size={14} className="text-accent-tan" />
                            </div>
                         </button>
                       ))}
                    </div>
                 </div>
              </div>
            </div>
          } />
          
          <Route path="/:id" element={
            <div className="flex-1 flex overflow-hidden">
               {/* Sidebar Details is rendered by the AnimatePresence below, 
                   but we need the Tree View here */}
               <div className="flex-1 relative h-full">
                <FamilyTree 
                  individuals={individuals} 
                  marriages={marriages}
                  onSelectIndividual={(ind) => {
                    if (ind) {
                      setSelectedIndividual(ind);
                      navigate(`/${ind.id}`);
                    } else {
                      setSelectedIndividual(null);
                      navigate('/');
                    }
                  }}
                  searchQuery={searchQuery}
                  selectedIndividualId={selectedIndividual?.id}
                />
                
                {/* Legend */}
                <div className="absolute bottom-5 left-14 md:left-16 bg-surface/90 backdrop-blur-sm p-3 md:p-4 rounded-xl border border-border-olive shadow-lg flex flex-col gap-2 md:gap-3 text-[10px] md:text-[11px] max-w-[calc(100vw-60px)] pointer-events-none">
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-blue-100 border border-blue-300 rounded-sm" />
                      <span className="font-bold text-blue-700">Laki-laki</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-rose-100 border border-rose-300 rounded-sm" />
                      <span className="font-bold text-rose-700">Perempuan</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className="w-2 md:w-3 h-0.5 bg-rose-800 rounded-full" />
                      <span className="font-bold text-rose-900">Leluhur</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className="w-2 md:w-3 h-0.5 bg-emerald-500 rounded-full" />
                      <span className="font-bold text-emerald-700">Keturunan</span>
                    </div>
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-indigo-500 rounded-sm" />
                      <span className="font-bold text-indigo-700">Sesama Keturunan</span>
                    </div>
                  </div>
                  <div className="h-px bg-border-olive/30 w-full" />
                  <div className="flex items-center justify-between gap-3 md:gap-4">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <div className="w-2 h-2 md:w-2.5 md:h-2.5 bg-verified-green rounded-full" />
                      <span className="text-ink-light">Terverifikasi</span>
                    </div>
                    <div className="font-mono text-primary-olive/60 font-bold bg-bg px-1.5 py-0.5 rounded text-[9px] md:text-[10px]">Alfanumerik & Kode Gen</div>
                  </div>
                </div>
              </div>
            </div>
          } />
        </Routes>
      </div>

      {/* Sidebar Detail */}
      <AnimatePresence>
        {selectedIndividual && (
          <IndividualDetail 
            individual={selectedIndividual} 
            individuals={individuals}
            marriages={marriages}
            onClose={() => {
              setSelectedIndividual(null);
              navigate('/');
            }}
            isAdmin={!!user}
            onEdit={handleEditIndividual}
            onSelectIndividual={setSelectedIndividual}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {isLoginOpen && (
          <LoginPage onBack={() => setIsLoginOpen(false)} />
        )}
        
        {isAdminPanelOpen && (
          <AdminPanel 
            onClose={() => setIsAdminPanelOpen(false)} 
            selectedIndividual={adminTargetIndividual}
            onRefresh={fetchData}
          />
        )}

        {isLembagaOpen && (
          <LembagaProfile onClose={() => setIsLembagaOpen(false)} />
        )}

        {isRelationshipSearchOpen && (
          <RelationshipSearch 
            individuals={individuals}
            onClose={() => setIsRelationshipSearchOpen(false)}
            onSelectIndividual={(id) => {
              const ind = individuals.find(i => i.id === id);
              if (ind) setSelectedIndividual(ind);
              setIsRelationshipSearchOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
