import React from 'react';
import { motion } from 'motion/react';
import { X, History, Users, Target, Phone, Mail, MapPin, ExternalLink, ShieldCheck } from 'lucide-react';

interface LembagaProfileProps {
  onClose: () => void;
}

export const LembagaProfile: React.FC<LembagaProfileProps> = ({ onClose }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm"
    >
      <div className="bg-bg w-full max-w-2xl max-h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-border-olive/30 shadow-primary-olive/20">
        <div className="p-4 bg-primary-olive text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1 shadow-inner overflow-hidden border border-border-olive/10">
              <img 
                src="https://drive.google.com/thumbnail?id=1fef9BVeWH_dsPNtk4udPh-MpivNcUiRJ&sz=w200" 
                alt="Logo Qomaruddin" 
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-primary-olive font-serif font-black text-xl">Q</span>';
                }}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight uppercase tracking-widest font-serif">Unit Lembaga Genealogi</h2>
              <p className="text-[10px] opacity-80 uppercase font-medium tracking-tighter">Yayasan Pondok Pesantren Qomaruddin</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-8">
          {/* Sejarah */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-primary-olive">
              <History size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Sejarah & Latar Belakang</h3>
            </div>
            <div className="prose prose-sm text-ink opacity-80 italic leading-relaxed text-xs">
              <p>
                Lembaga Genealogi Qomaruddin didirikan untuk mendokumentasikan, memverifikasi, dan melestarikan silsilah keturunan Kiai Qomaruddin, pendiri Pondok Pesantren Qomaruddin Sampurnan Bungah.
              </p>
              <p>
                Berawal dari catatan-catatan manual para sesepuh, lembaga ini bertransformasi menjadi unit modern yang menggunakan teknologi digital untuk memastikan akurasi nasab bagi seluruh dzurriyat (keturunan).
              </p>
            </div>
          </section>

          {/* Program Kerja */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-primary-olive">
              <Target size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Program Unggulan</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "Digitalisasi Nasab", desc: "Digitalisasi database seluruh dzurriyat Qomaruddin." },
                { title: "Verifikasi Data", desc: "Validasi bukti sejarah dan saksi untuk pengajuan data baru." },
                { title: "Penerbitan Syahadah", desc: "Penerbitan sertifikat bukti keturunan bagi yang terverifikasi." },
                { title: "Temu Dzurriyat", desc: "Penyelenggaraan acara tahunan untuk mempererat silaturahmi." }
              ].map((prog, i) => (
                <div key={i} className="p-3 bg-bg-light rounded-xl border border-border-olive/20">
                  <h4 className="text-[11px] font-bold text-primary-olive mb-1 uppercase">{prog.title}</h4>
                  <p className="text-[10px] text-ink-light leading-tight">{prog.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Tim Lembaga */}
          <section>
            <div className="flex items-center gap-2 mb-3 text-primary-olive">
              <Users size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Struktur Organisasi</h3>
            </div>
            <div className="space-y-2">
              {[
                { role: "Ketua Lembaga", name: "K.H. Ahmad Iklil Sholeh" },
                { role: "Sekretaris", name: "Ust. M. Muallif" },
                { role: "Divisi IT & Database", name: "Tim IT Qomaruddin" },
                { role: "Tim Verifikator", name: "Dewan Kiai Sampurnan" }
              ].map((person, i) => (
                <div key={i} className="flex justify-between items-center p-2 border-b border-border-olive/10">
                  <span className="text-[10px] text-ink-light uppercase font-medium">{person.role}</span>
                  <span className="text-xs font-bold text-ink italic">{person.name}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Kontak */}
          <section className="bg-primary-olive/5 p-4 rounded-2xl border border-primary-olive/10">
            <div className="flex items-center gap-2 mb-4 text-primary-olive">
              <Phone size={18} />
              <h3 className="text-sm font-bold uppercase tracking-wider">Hubungi Kami (Call Center)</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a 
                href="https://wa.me/628995023222" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center text-white">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-ink-light uppercase font-black tracking-tighter">WhatsApp Admin</p>
                  <p className="text-xs font-bold text-ink">+62 899-5023-222</p>
                </div>
                <ExternalLink size={14} className="ml-auto text-ink-light group-hover:text-primary-olive" />
              </a>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm">
                <div className="w-10 h-10 bg-primary-olive rounded-lg flex items-center justify-center text-white">
                  <Mail size={20} />
                </div>
                <div>
                  <p className="text-[10px] text-ink-light uppercase font-black tracking-tighter">Email Resmi</p>
                  <p className="text-xs font-bold text-ink truncate">genealogi@qomaruddin.sch.id</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-3 p-3 text-[11px] text-ink-light">
              <MapPin size={16} className="shrink-0 text-primary-olive" />
              <p>Kantor Lembaga Genealogi – Komplek Pondok Pesantren Qomaruddin, Sampurnan, Bungah, Gresik, Jawa Timur.</p>
            </div>
          </section>
        </div>

        <div className="p-4 bg-bg-light border-t border-border-olive/20 text-center">
          <p className="text-[10px] text-ink-light italic">"Menyambung Nasab, Menguatkan Silaturahmi"</p>
        </div>
      </div>
    </motion.div>
  );
};
