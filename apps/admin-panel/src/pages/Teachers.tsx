import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import WebApp from '../telegram';
import { Camera, User, Plus, Trash2, Pencil, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';

export default function Teachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ id: '', ismFamiliya: '', telefon: '', fanNomi: '', telegramId: '', rasmFileId: '' });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, rasmFileId: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const [data, people] = await Promise.all([api.getTeachers(), api.getAdmins()]);
      setTeachers(data);
      setAdmins(people);
    } catch (e: any) {
      WebApp.showAlert(e.message || 'Xatolik yuz berdi');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const openAdd = () => {
    setFormData({ id: '', ismFamiliya: '', telefon: '', fanNomi: '', telegramId: '', rasmFileId: '' });
    setModalVisible(true);
  };

  const openEdit = (t: any) => {
    setFormData({ 
      id: t.id, 
      ismFamiliya: t.ismFamiliya, 
      telefon: t.telefon || '', 
      fanNomi: t.fanNomi,
      telegramId: t.telegramId?.toString() || '',
      rasmFileId: t.rasmFileId || ''
    });
    setModalVisible(true);
  };

  const saveForm = async () => {
    if (!formData.ismFamiliya || !formData.telegramId || !formData.fanNomi) {
      WebApp.showAlert("Ism, Fan va Telegram ID kiritilishi shart");
      return;
    }
    
    if (!/^[1-9]\d{0,15}$/.test(formData.telegramId)) { WebApp.showAlert('Telegram ID faqat musbat raqamlardan iborat bo‘lsin'); return; }
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (formData.id) {
        await api.updateTeacher(formData.id, formData);
      } else {
        await api.createTeacher(formData);
      }
      setModalVisible(false);
      fetchTeachers();
    } catch (e: any) {
      WebApp.showAlert(e.message || "Xatolik yuz berdi");
    }
    setIsSaving(false);
  };

  const handleDelete = (id: string) => {
    WebApp.showConfirm("O‘qituvchini olib tashlaysizmi? Davomat tarixi va guruhlari saqlanadi. Admin bo‘lsa, admin huquqi ham saqlanadi.", (confirmed) => {
      if (confirmed) {
        api.deleteTeacher(id).then(() => {
          fetchTeachers();
        }).catch((e: any) => WebApp.showAlert(e.message || "O'chirishda xatolik"));
      }
    });
  };

  const handleToggleBlock = (t: any) => {
    const action = t.faolmi ? "bloklamoqchimisiz?" : "faollashtirmoqchimisiz?";
    WebApp.showConfirm(`Haqiqatan ham ${action}`, (confirmed) => {
      if (confirmed) {
        api.updateTeacher(t.id, { faolmi: !t.faolmi }).then(() => {
          fetchTeachers();
        }).catch((e: any) => WebApp.showAlert(e.message || "Xatolik"));
      }
    });
  };

  if (loading && teachers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80"></div>
        <p className="text-tgHint font-medium">O'qituvchilar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-extrabold">O'qituvchilar</h1>
        <button onClick={openAdd} className="bg-tgButton text-tgButtonText px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-1 active:scale-95 transition-transform">
          <Plus size={18} /> Yangi
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {teachers.map(t => (
          <div key={t.id} className={`bg-[#161c28] p-5 rounded-3xl flex flex-col justify-between border border-gray-700/30 shadow-lg transition-all hover:border-gray-600/50 relative overflow-hidden group ${!t.faolmi ? 'opacity-75' : ''}`}>
             
             {!t.faolmi && <div className="absolute top-0 right-0 bg-red-500/20 text-red-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">Bloklangan</div>}

             <div>
               <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-[#1e2532] flex items-center justify-center overflow-hidden shrink-0 border-2 border-gray-700/50 shadow-inner">
                    {t.rasmFileId ? (
                      <img src={t.rasmFileId} alt={t.ismFamiliya} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-[17px] text-white leading-tight mb-0.5">
                      {t.ismFamiliya}
                    </h3>
                    <p className="text-[13px] text-blue-400 font-semibold">{t.fanNomi}</p>
                    {admins.some(a => String(a.telegramId) === String(t.telegramId)) && <p className="text-xs text-blue-400 mt-1">O‘qituvchi + Admin</p>}
                  </div>
               </div>
               <div className="bg-[#1e2532] rounded-xl p-3 mb-4 border border-gray-700/30">
                 <p className="text-xs text-gray-400 font-medium mb-1">Telegram ID: <span className="text-gray-200 font-bold select-all">{t.telegramId}</span></p>
                 {t.telefon && <p className="text-xs text-gray-400 font-medium">Telefon: <span className="text-gray-200">{t.telefon}</span></p>}
               </div>
             </div>

             <div className="flex gap-2 border-t border-gray-700/50 pt-4">
               <button onClick={() => handleToggleBlock(t)} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors
                 ${t.faolmi ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}>
                 {t.faolmi ? <ShieldAlert size={14} /> : <CheckCircle size={14} />}
                 {t.faolmi ? 'Bloklash' : 'Faollash'}
               </button>
               <button onClick={() => openEdit(t)} className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                 <Pencil size={14} /> Tahrir
               </button>
               <button onClick={() => handleDelete(t.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2 rounded-xl flex items-center justify-center transition-colors">
                 <Trash2 size={16} />
               </button>
             </div>
          </div>
        ))}
        {teachers.length === 0 && (
          <div className="col-span-full text-center py-12 bg-[#161c28] rounded-3xl border border-dashed border-gray-700/50 mt-4">
            <User className="mx-auto text-gray-500 opacity-40 mb-3 w-12 h-12" />
            <p className="text-gray-400 font-medium text-lg">O'qituvchilar mavjud emas</p>
          </div>
        )}
      </div>

      {modalVisible && (
        <div className="app-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-tgBg rounded-3xl p-4 w-full max-w-sm shadow-2xl border border-gray-500/10 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2 text-white">
              {formData.id ? <Pencil size={20} className="text-tgButton" /> : <Plus size={20} className="text-tgButton" />}
              {formData.id ? 'Tahrirlash' : "Yangi O'qituvchi"}
            </h2>
            
            <div className="space-y-2.5">
              {!formData.id && <div>
                <label className="text-xs font-bold text-gray-400 mb-1.5 block">Mavjud admindan tanlash</label>
                <select aria-label="Mavjud admindan tanlash" value={admins.some(a => String(a.telegramId) === formData.telegramId) ? formData.telegramId : ''}
                  onChange={e => { const a = admins.find(a => String(a.telegramId) === e.target.value); setFormData({...formData, telegramId: a ? String(a.telegramId) : '', ismFamiliya: a?.ismFamiliya || ''}); }}
                  className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl p-3 text-white">
                  <option value="">Tanlang yoki Telegram ID kiriting</option>
                  {admins.map(a => <option key={a.id} value={String(a.telegramId)} disabled={teachers.some(t => String(t.telegramId) === String(a.telegramId) && t.faolmi)}>{a.ismFamiliya} · {a.telegramId}{teachers.some(t => String(t.telegramId) === String(a.telegramId) && t.faolmi) ? ' · Allaqachon o‘qituvchi' : ''}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-2">Admin huquqi saqlanadi. Fan nomini ham kiriting.</p>
              </div>}
              
              {/* Photo Upload */}
              <div className="flex flex-col items-center mb-2">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-full bg-[#1e2532] border-2 border-dashed border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden relative group"
                >
                  {formData.rasmFileId ? (
                    <>
                      <img src={formData.rasmFileId} alt="Profile" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera size={20} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400 group-hover:text-white transition-colors">
                      <Camera size={20} className="mb-0.5" />
                      <span className="text-[9px] font-bold uppercase">Rasm</span>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImageChange} 
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">F.I.SH.</label>
                <input 
                  type="text" 
                  value={formData.ismFamiliya}
                  onChange={e => setFormData({...formData, ismFamiliya: e.target.value})}
                  className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl px-3 py-2 text-[15px] text-white font-medium outline-none focus:border-blue-500 transition-colors"
                  placeholder="Xoliqov Temur"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Asosiy Fani</label>
                <input 
                  type="text" 
                  value={formData.fanNomi}
                  onChange={e => setFormData({...formData, fanNomi: e.target.value})}
                  className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl px-3 py-2 text-[15px] text-white font-medium outline-none focus:border-blue-500 transition-colors"
                  placeholder="Matematika"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Telegram ID</label>
                <input 
                  type="text" inputMode="numeric" 
                  value={formData.telegramId}
                  onChange={e => { const telegramId = e.target.value.trim(); const a = admins.find(a => String(a.telegramId) === telegramId); setFormData({...formData, telegramId, ...(!formData.id && a ? {ismFamiliya: a.ismFamiliya} : {})}); }}
                  className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl px-3 py-2 text-[15px] text-white font-medium outline-none focus:border-blue-500 transition-colors"
                  placeholder="123456789"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Telefon (ixtiyoriy)</label>
                <input 
                  type="text" 
                  value={formData.telefon}
                  onChange={e => setFormData({...formData, telefon: e.target.value})}
                  className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl px-3 py-2 text-[15px] text-white font-medium outline-none focus:border-blue-500 transition-colors"
                  placeholder="+998..."
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-5">
              <button 
                onClick={() => setModalVisible(false)} 
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-[#161c28] text-gray-400 font-bold hover:bg-[#1e2532] transition-colors border border-gray-700/30 disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button 
                onClick={saveForm} 
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
