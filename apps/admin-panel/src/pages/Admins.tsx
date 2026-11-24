import { useEffect, useState } from 'react';
import { api } from '../api';
import WebApp from '../telegram';
import { Shield, KeyRound, Plus, Trash2, UserCog, User, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function Admins() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ ismFamiliya: '', telegramId: '', lavozim: '' });
  
    
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const [data, people] = await Promise.all([api.getAdmins(), api.getTeachers()]);
      setAdmins(data);
      setTeachers(people);
    } catch (e: any) {
      WebApp.showAlert(e.message || 'Xatolik yuz berdi');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const openAdd = () => {
    setFormData({ ismFamiliya: '', telegramId: '', lavozim: '' });
    setModalVisible(true);
  };

  const saveForm = async () => {
    if (!formData.ismFamiliya || !formData.telegramId) {
      WebApp.showAlert("Ism va Telegram ID kiritilishi shart");
      return;
    }
    
    if (!/^[1-9]\d{0,15}$/.test(formData.telegramId)) { WebApp.showAlert('Telegram ID faqat musbat raqamlardan iborat bo‘lsin'); return; }
    if (isSaving) return;
    setIsSaving(true);
    try {
      await api.createAdmin(formData);
      setModalVisible(false);
      fetchAdmins();
    } catch (e: any) {
      WebApp.showAlert(e.message || "Xatolik yuz berdi");
    } finally { setIsSaving(false); }
  };

  
  const handleDelete = (id: string) => {
    WebApp.showConfirm("Haqiqatan ham o'chirmoqchimisiz? (Faqat admin huquqi olib tashlanadi, o‘qituvchi va guruh rahbarligi saqlanadi)", (confirmed) => {
      if (confirmed) {
        api.deleteAdmin(id).then(() => {
          fetchAdmins();
        }).catch((e: any) => {
          WebApp.showAlert(e.message);
        });
      }
    });
  };

  if (loading && admins.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80"></div>
        <p className="text-tgHint font-medium">Xodimlar yuklanmoqda...</p>
      </div>
    );
  }

  
  return (
    <div className="p-4 pb-24">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          Adminlar
        </h1>
        <button 
          onClick={openAdd} 
          className="bg-tgButton text-tgButtonText px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-1 active:scale-95 transition-transform"
        >
          <Plus size={18} /> Yangi
        </button>
      </div>

      

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {admins.map(t => (
          <div key={t.id} className="bg-[#161c28] p-5 rounded-3xl flex flex-col justify-between border border-gray-700/30 shadow-lg transition-all hover:border-gray-600/50 relative overflow-hidden group">
            
            <div>
               <div className="flex items-start justify-between mb-4">
                 <div>
                   <h3 className="font-extrabold text-[18px] text-white leading-tight mb-1.5">{t.ismFamiliya}</h3>
                   {teachers.some(p => String(p.telegramId) === String(t.telegramId) && p.faolmi) && <p className="text-xs text-blue-400 mb-2">Admin + O‘qituvchi</p>}
                   {t.id === 'super' ? (
                     <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                       ASOSIY EGA
                     </span>
                   ) : (
                     <span className="text-[10px] font-bold text-gray-400 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                       {t.lavozim || 'XODIM'}
                     </span>
                   )}
                 </div>
                 <div className="w-10 h-10 rounded-full bg-[#1e2532] flex items-center justify-center border border-gray-700/50 shrink-0">
                    {t.id === 'super' ? <Shield size={18} className="text-blue-400" /> : <UserCog size={18} className="text-gray-400" />}
                 </div>
               </div>
               
               <div className="bg-[#1e2532] rounded-xl p-3 mb-2 border border-gray-700/30 space-y-2">
                 <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1"><User size={12}/> Telegram ID:</span>
                    <span className="text-sm font-bold text-white bg-gray-800/50 px-2 py-0.5 rounded border border-gray-700/50">{t.telegramId}</span>
                 </div>
               </div>
            </div>

            {t.id !== 'super' && (
              <div className="mt-4 pt-3 border-t border-gray-700/50 flex gap-2">
                <button 
                  onClick={() => handleDelete(t.id)} 
                  className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl font-bold flex justify-center items-center gap-1.5 text-sm transition-colors border border-red-500/10"
                >
                  <Trash2 size={16} /> O'chirish
                </button>
              </div>
            )}
          </div>
        ))}
        
        {admins.length === 0 && (
          <div className="col-span-full py-10 flex flex-col items-center justify-center text-gray-500 bg-[#161c28] rounded-3xl border border-gray-700/30">
             <UserCog size={48} className="mb-3 opacity-20" />
             <p className="font-medium text-sm">Hech qanday admin qo'shilmagan</p>
          </div>
        )}
      </div>

      {modalVisible && (
        <div className="app-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100]">
          <div className="bg-[#1e2532] w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-gray-700/50 shadow-2xl animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <h2 className="text-xl font-extrabold mb-5 text-white flex items-center gap-2">
              <UserCog size={22} className="text-tgButton" /> Yangi Admin
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 mb-1.5 block">Mavjud o‘qituvchidan tanlash</label>
                <select aria-label="Mavjud o‘qituvchidan tanlash" value={teachers.some(t => String(t.telegramId) === formData.telegramId) ? formData.telegramId : ''}
                  onChange={e => { const t = teachers.find(t => String(t.telegramId) === e.target.value); setFormData({...formData, telegramId: t ? String(t.telegramId) : '', ismFamiliya: t?.ismFamiliya || ''}); }}
                  className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl p-3 text-white">
                  <option value="">Tanlang yoki pastda Telegram ID kiriting</option>
                  {teachers.map(t => <option key={t.id} value={String(t.telegramId)} disabled={admins.some(a => String(a.telegramId) === String(t.telegramId))}>{t.ismFamiliya} · {t.telegramId}{admins.some(a => String(a.telegramId) === String(t.telegramId)) ? ' · Allaqachon admin' : !t.faolmi ? ' · O‘qituvchi bloklangan' : ''}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-2">O‘qituvchi profili va guruh rahbarligi saqlanadi.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5 block">F.I.SH.</label>
                <input 
                  type="text" 
                  value={formData.ismFamiliya}
                  onChange={e => setFormData({...formData, ismFamiliya: e.target.value})}
                  className="w-full bg-[#161c28] border border-gray-700/50 focus:border-tgButton/50 rounded-xl p-3 text-white outline-none transition-colors"
                  placeholder="Xoliqov Temur"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5 block">Telegram ID</label>
                <input 
                  type="text" inputMode="numeric" 
                  value={formData.telegramId}
                  onChange={e => { const telegramId = e.target.value.trim(); const t = teachers.find(t => String(t.telegramId) === telegramId); setFormData({...formData, telegramId, ...(t ? {ismFamiliya: t.ismFamiliya} : {})}); }}
                  className="w-full bg-[#161c28] border border-gray-700/50 focus:border-tgButton/50 rounded-xl p-3 text-white outline-none transition-colors"
                  placeholder="123456789"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1.5 block">Lavozim (ixtiyoriy)</label>
                <input 
                  type="text" 
                  value={formData.lavozim}
                  onChange={e => setFormData({...formData, lavozim: e.target.value})}
                  className="w-full bg-[#161c28] border border-gray-700/50 focus:border-tgButton/50 rounded-xl p-3 text-white outline-none transition-colors"
                  placeholder="Masalan: Menejer"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-8">
              <button onClick={() => setModalVisible(false)} className="flex-1 py-3 rounded-xl bg-gray-700/30 text-gray-300 font-bold hover:bg-gray-700/50 transition-colors">
                Bekor qilish
              </button>
              <button disabled={isSaving} onClick={saveForm} className="flex-1 py-3 rounded-xl bg-tgButton text-tgButtonText font-bold shadow-lg shadow-tgButton/20 hover:shadow-tgButton/40 transition-all flex items-center justify-center gap-1.5">
                <CheckCircle2 size={18} /> {isSaving ? 'Saqlanmoqda...' : "Qo'shish"}
              </button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}
