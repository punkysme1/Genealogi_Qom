import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginPageProps {
  onBack: () => void;
}

export default function LoginPage({ onBack }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      // Login success will be handled by the onAuthStateChange listener in App
    } catch (err: any) {
      setError(err.message || 'Gagal masuk. Silakan periksa kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-border-olive overflow-hidden"
      >
        <div className="p-8">
          <button 
            onClick={onBack}
            className="mb-8 flex items-center gap-2 text-ink-light hover:text-primary-olive transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} /> Kembali ke Silsilah
          </button>

          <div className="mb-8">
            <h2 className="text-3xl font-serif font-bold text-ink">Admin Login</h2>
            <p className="text-ink-light mt-2">Masuk untuk mengelola data silsilah Qomaruddin.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 text-sm rounded-xl">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-ink-light mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-light" size={18} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-bg border border-border-olive rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-olive/20 focus:border-primary-olive transition-all"
                  placeholder="admin@qomaruddin.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-ink-light mb-2">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-light" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-bg border border-border-olive rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-olive/20 focus:border-primary-olive transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary-olive text-white rounded-xl font-bold shadow-lg shadow-primary-olive/20 hover:bg-primary-olive/90 transition-all flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>Masuk Sekarang</>
              )}
            </button>
          </form>
        </div>

        <div className="bg-bg p-6 text-center border-t border-border-olive">
          <p className="text-[11px] text-ink-light uppercase tracking-widest">
            Family Tree Qomaruddin Heritage Archive
          </p>
        </div>
      </motion.div>
    </div>
  );
}
