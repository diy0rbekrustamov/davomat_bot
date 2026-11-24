import { useEffect, useState, useRef } from 'react';
import WebApp from '../telegram';
import { User, Phone, BookOpen, Camera, CheckCircle2 } from 'lucide-react';
import { API_BASE, getHeaders } from '../App';

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE}/teachers/me`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      WebApp.showAlert('Rasm hajmi 5MB dan oshmasligi kerak');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const res = await fetch(`${API_BASE}/teachers/me/photo`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ rasmFileId: base64 })
        });
        
        if (res.ok) {
          WebApp.showAlert('Rasm muvaffaqiyatli yangilandi!');
          await fetchProfile();
        } else {
          WebApp.showAlert('Rasmni yuklashda xatolik yuz berdi');
        }
      } catch (err) {
        WebApp.showAlert('Tarmoq xatosi');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80"></div>
        <p className="text-tgHint font-medium">Profil yuklanmoqda...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center p-6 pt-20 text-tgHint">
        Profil ma'lumotlari topilmadi
      </div>
    );
  }

  return (
    <div className="app-page bg-tgBg pb-28 animate-in fade-in">
      {/* Header Section */}
      <div className="relative pt-10 pb-8 px-6 bg-gradient-to-b from-blue-500/15 via-blue-500/5 to-tgBg flex flex-col items-center rounded-b-3xl">
        <div className="relative mb-5">
          <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden bg-tgSecondaryBg shadow-xl ring-4 ring-tgBg relative">
            {uploading ? (
              <div className="absolute inset-0 flex justify-center items-center bg-black/40 backdrop-blur-sm z-10">
                <div className="w-8 h-8 border-t-2 border-b-2 border-white opacity-90 rounded-full animate-spin"></div>
              </div>
            ) : null}
            {profile.rasmFileId ? (
              <img src={profile.rasmFileId} alt={profile.ismFamiliya} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-blue-500/50 bg-blue-500/10">
                <User size={54} strokeWidth={1.5} />
              </div>
            )}
          </div>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-2 -right-2 w-11 h-11 bg-blue-500 rounded-full flex justify-center items-center text-white ring-4 ring-tgBg shadow-lg active:scale-90 transition-all disabled:opacity-50 z-20"
          >
            <Camera size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handlePhotoUpload}
          />
        </div>
        
        <h2 className="text-2xl font-extrabold text-tgText text-center tracking-tight">{profile.ismFamiliya}</h2>
        
        <div className="flex items-center justify-center mt-3 gap-2">
          <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-lg text-[13px] font-bold flex items-center shadow-sm">
            <CheckCircle2 size={14} className="mr-1.5" /> Tasdiqlangan
          </span>
          <span className="bg-tgSecondaryBg text-tgHint px-3 py-1 rounded-lg text-[13px] font-bold shadow-sm">
            ID: {profile.telegramId}
          </span>
        </div>
      </div>

      {/* Info Section */}
      <div className="px-5 mt-2">
        <h3 className="text-xs font-bold text-tgHint uppercase tracking-wider mb-2 ml-4">Shaxsiy ma'lumotlar</h3>
        
        <div className="bg-tgSecondaryBg rounded-3xl overflow-hidden shadow-sm">
          
          <div className="flex items-center p-4 active:bg-tgHint/5 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mr-4 shrink-0">
              <BookOpen size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-tgHint font-medium mb-0.5">Mutaxassislik fani</p>
              <p className="font-bold text-tgText text-[16px] truncate">{profile.fanNomi}</p>
            </div>
          </div>
          
          <div className="h-[1px] bg-tgHint/10 ml-[72px]"></div>
          
          <div className="flex items-center p-4 active:bg-tgHint/5 transition-colors">
            <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center text-green-500 mr-4 shrink-0">
              <Phone size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-tgHint font-medium mb-0.5">Telefon raqam</p>
              <p className="font-bold text-tgText text-[16px] truncate">{profile.telefon || 'Kiritilmagan'}</p>
            </div>
          </div>

        </div>
      </div>

      <div className="flex justify-center mt-6 mb-4">
        <a href="https://provveb.uz" target="_blank" rel="noopener noreferrer" className="text-tgHint text-xs font-medium hover:text-tgText transition-colors">
          by provveb.uz / samir
        </a>
      </div>
    </div>
  );
}
