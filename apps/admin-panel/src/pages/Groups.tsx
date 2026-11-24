import { Fragment, useEffect, useState } from 'react';
import { api } from '../api';
import { createGroupQrZip, renderGroupQr } from '../utils/group-qr';
import WebApp from '../telegram';
import { Users, QrCode, Pencil, Trash2, FileSpreadsheet, Plus, UploadCloud, Loader2 } from 'lucide-react';

export default function Groups() {
  const [teacherPolicy,setTeacherPolicy]=useState<boolean|null>(null),[policyBusy,setPolicyBusy]=useState(false);
  const [policyError,setPolicyError]=useState('');
  useEffect(()=>{void api.getTeacherGroupPolicy().then(r=>setTeacherPolicy(r.enabled)).catch(e=>setPolicyError(e.message));},[]);
  const toggleTeacherPolicy=async()=>{if(policyBusy||teacherPolicy===null)return;setPolicyBusy(true);setPolicyError('');try{const r=await api.setTeacherGroupPolicy(!teacherPolicy);setTeacherPolicy(r.enabled);}catch(e:any){setPolicyError(e.message);}finally{setPolicyBusy(false);}};
  const [groups, setGroups] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [chatSearch,setChatSearch]=useState('');
  const [chatsLoading,setChatsLoading]=useState(false);
  const refreshChats=async()=>{setChatsLoading(true);try{setChats(await api.getTelegramChats());}catch(e:any){WebApp.showAlert(e.message||'Guruhlar yuklanmadi');}finally{setChatsLoading(false);}};
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({ id: '', nomi: '', kurs: 1, sinfRahbariIsmi: '', sinfRahbariTelefon: '', teacherId: '', telegramChatIds: [] as string[] });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [viewingGroup, setViewingGroup] = useState<any>(null);
  const [groupStudents, setGroupStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [studentBusy, setStudentBusy] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState<any>(null);

  const saveStudent = async (id: string) => {
    if (studentBusy || !editedName.trim()) return;
    setStudentBusy(true);
    try {
      const updated = await api.updateStudent(id, editedName.trim());
      setGroupStudents(items => items.map(item => item.id === id ? updated : item));
      setEditingStudent(null);
    } catch (error: any) { WebApp.showAlert(error.message || 'Saqlanmadi'); }
    finally { setStudentBusy(false); }
  };
  const removeStudent = async () => {
    if (studentBusy || !deletingStudent) return;
    const id = deletingStudent.id;
    setStudentBusy(true);
    try {
      await api.deleteStudent(id);
      setGroupStudents(items => items.filter(item => item.id !== id));
      setGroups(items => items.map(item => item.id === viewingGroup.id ? { ...item, _count: { ...item._count, students: Math.max(0, (item._count?.students || 0) - 1) } } : item));
      setDeletingStudent(null);
    } catch (error: any) { WebApp.showAlert(error.message || "O'chirilmadi"); }
    finally { setStudentBusy(false); }
  };

  const openStudentsView = async (group: any) => {
    setEditingStudent(null);
    setDeletingStudent(null);
    setShowAddForm(false);
    setNewStudentName('');
    setGroupStudents([]);
    setViewingGroup(group);
    setStudentsLoading(true);
    try {
      const data = await api.getGroupById(group.id);
      setGroupStudents(data.students || []);
    } catch(e: any) {
      WebApp.showAlert(e.message || 'Xatolik');
    }
    setStudentsLoading(false);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !viewingGroup) return;
    
    setIsAddingStudent(true);
    try {
      await api.addStudent(viewingGroup.id, { ismFamiliya: newStudentName });
      const data = await api.getGroupById(viewingGroup.id);
      setGroupStudents(data.students || []);
      setNewStudentName('');
      fetchGroups(); // Update count
    } catch (e: any) {
      WebApp.showAlert(e.message || 'Xatolik yuz berdi');
    }
    setIsAddingStudent(false);
  };

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await api.getGroupsPage();
      setGroups(data.groups);
      setTeachers(data.teachers);
      setChats(data.chats);
    } catch (e: any) {
      WebApp.showAlert(e.message || 'Xatolik yuz berdi');
    }
    setLoading(false);
  };

  useEffect(() => {void fetchGroups();}, []);
  useEffect(()=>{if(!modalVisible)return;void refreshChats();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refreshChats();},15000);const onFocus=()=>void refreshChats();window.addEventListener('focus',onFocus);return()=>{clearInterval(timer);window.removeEventListener('focus',onFocus);};},[modalVisible]);

  const openAdd = () => {
    setFormData({ id: '', nomi: '', kurs: 1, sinfRahbariIsmi: '', sinfRahbariTelefon: '', teacherId: '', telegramChatIds: [] as string[] });
    setImportFile(null);
    setModalVisible(true);
  };

  const openEdit = (g: any) => {
    setFormData({ id: g.id, nomi: g.nomi, kurs: g.kurs || 1, sinfRahbariIsmi: g.sinfRahbariIsmi, sinfRahbariTelefon: g.sinfRahbariTelefon || '', teacherId: g.teacherId || '', telegramChatIds: Array.isArray(g.telegramChatIds)?g.telegramChatIds:(g.telegramChatId?[g.telegramChatId]:[]) });
    setImportFile(null);
    setModalVisible(true);
  };

  const saveForm = async () => {
    if (!formData.nomi || !formData.teacherId) {
      WebApp.showAlert("Nomi va o'qituvchini tanlang");
      return;
    }
    
    setIsSaving(true);
    try {
      let savedGroup;
      if (formData.id) {
        savedGroup = await api.updateGroup(formData.id, formData);
      } else {
        savedGroup = await api.createGroup(formData);
      }
      
      if (importFile) {
        if (formData.id) {
          // Editing existing group
          WebApp.showConfirm("Guruh o'quvchilar ro'yxatini ushbu yangi faylga almashtirasizmi?", async (confirmed) => {
            try {
              if (confirmed) {
                await api.importStudents(savedGroup.id, importFile, true);
                WebApp.showAlert("Guruh va o'quvchilar ro'yxati yangilandi!");
              }
            } catch(e: any) {
              WebApp.showAlert(e.message || "Xatolik yuz berdi");
            } finally {
              setIsSaving(false);
              setModalVisible(false);
              fetchGroups();
            }
          });
          return; // Early return because modal is handled in callback
        } else {
          // Creating new group
          await api.importStudents(savedGroup.id, importFile, false);
          WebApp.showAlert("Guruh va o'quvchilar muvaffaqiyatli saqlandi!");
        }
      }
      setIsSaving(false);
      setModalVisible(false);
      fetchGroups();
    } catch (e: any) {
      setIsSaving(false);
      WebApp.showAlert(e.message || "Xatolik yuz berdi");
    }
  };

  const handleDelete = (id: string) => {
    WebApp.showConfirm("Haqiqatan ham o'chirmoqchimisiz? (Arxivlanadi)", (confirmed) => {
      if (confirmed) {
        api.deleteGroup(id).then(()=>fetchGroups()).catch((e:any)=>WebApp.showAlert(e.message||'Arxivlashda xatolik'));
      }
    });
  };

  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [activeGroup, setActiveGroup] = useState<any>(null);
  const [sendingQr, setSendingQr] = useState(false);

  const showQr = (group: any) => {
    if (group.qrCodeImageUrl) {
      setActiveGroup(group);
      setQrModalVisible(true);
    } else {
      WebApp.showAlert("QR Code mavjud emas");
    }
  };

  const [sendingZip, setSendingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);

  const downloadAllQr = async () => {
    if (sendingZip || !groups.length) return;
    setSendingZip(true);
    setZipProgress(0);
    try {
      const base64 = await createGroupQrZip(groups, setZipProgress);
      const result = await api.sendQrZipToTelegram(base64);
      WebApp.showAlert(result.message);
    } catch (error: any) {
      WebApp.showAlert(error.message || 'ZIP yuborishda xatolik');
    } finally { setSendingZip(false); }
  };

  const downloadQr = async () => {
    if (!activeGroup || sendingQr) return;
    setSendingQr(true);
    try {
      const base64 = await renderGroupQr(activeGroup);
      const result = await api.sendQrToTelegram(base64, activeGroup.nomi);
      WebApp.showAlert(result.message || 'Yuborildi!');
      setQrModalVisible(false);
    } catch (error: any) {
      WebApp.showAlert(error.message || 'QR yuborishda xatolik');
    } finally { setSendingQr(false); }
  };
  const currentGroup = groups.find(g=>g.id===formData.id);
  if (loading && groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">

        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80"></div>
        <p className="text-tgHint font-medium">Guruhlar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      <section className="p-3 mb-4 border border-gray-500/30 rounded-xl text-sm space-y-2"><p>O‘qituvchilarning guruh boshqaruvi: {teacherPolicy===null?'tekshirilmoqda…':teacherPolicy?'ochiq':'yopiq'}</p><button disabled={policyBusy||teacherPolicy===null} onClick={()=>void toggleTeacherPolicy()} className="p-2 rounded bg-blue-600 text-white disabled:opacity-50">{policyBusy?'Saqlanmoqda…':teacherPolicy?'Guruh qo‘shish/tahrirlashni yopish':'Guruh qo‘shish/tahrirlashni ochish'}</button>{policyError&&<p role="alert" className="text-red-400">{policyError}</p>}</section>
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          Guruhlar
        </h1>
        <button 
          onClick={openAdd} 
          className="bg-tgButton text-tgButtonText px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-1 active:scale-95 transition-transform"
        >
          <Plus size={18} /> Yangi
        </button>
      </div>

      <button
        onClick={downloadAllQr}
        disabled={sendingZip || loading || groups.length === 0}
        className="w-full mb-2 py-3 px-4 rounded-xl bg-tgButton text-tgButtonText font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {sendingZip ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
        {sendingZip ? (zipProgress < groups.length ? `Tayyorlanmoqda: ${zipProgress}/${groups.length}` : 'ZIP yuborilmoqda...') : 'Barcha QR kodlar — ZIP (A4)'}
      </button>
      <p className="text-xs text-tgHint mb-5">Guruh nomi yozilgan A4 rasmlar bitta ZIP faylda Telegram botingizga yuboriladi.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {groups.map((g,index) => (
          <Fragment key={g.id}>
            {(index===0 || groups[index-1].kurs!==g.kurs) && <div className="col-span-full flex items-center justify-between border-b border-gray-700/50 pt-5 pb-3"><h2 className="text-lg font-extrabold text-white">{g.kurs}-kurs</h2><span className="text-sm text-gray-400">{groups.filter(item=>item.kurs===g.kurs).length} ta guruh</span></div>}
          <div key={g.id} className="bg-[#161c28] p-5 rounded-3xl flex flex-col justify-between border border-gray-700/30 shadow-lg transition-all hover:border-gray-600/50 relative overflow-hidden group">
            
            <div>
                <div 
                  className="flex items-start justify-between mb-4 cursor-pointer"
                  onClick={() => openStudentsView(g)}
                >
                  <div>
                    <h3 className="font-extrabold text-[18px] text-white leading-tight mb-1.5">{g.nomi}</h3>
                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {g.kurs}-kurs
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#1e2532] flex items-center justify-center border border-gray-700/50 hover:bg-gray-700/50 transition-colors">
                    <Users size={18} className="text-gray-400" />
                  </div>
                </div>
               
               <div className="bg-[#1e2532] rounded-xl p-3 mb-4 border border-gray-700/30 space-y-2">
                 <div className="flex items-center justify-between">
                   <span className="uppercase tracking-wider text-[10px] font-bold text-gray-500">Rahbar</span>
                   <span className="text-gray-200 font-bold text-xs">{g.teacher?.ismFamiliya || 'Rahbarni tanlash kerak'}</span>
                 </div>
                 <div className="flex items-center justify-between">
                   <span className="uppercase tracking-wider text-[10px] font-bold text-gray-500">O'quvchilar</span>
                   <span className="text-gray-200 font-bold text-xs">{g._count?.students || 0} ta</span>
                 </div>
               </div>
            </div>

             <div className="flex gap-2 border-t border-gray-700/50 pt-4">
               <button onClick={() => showQr(g)} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.2)]">
                 <QrCode size={14} /> QR Code
               </button>
               <button onClick={() => openEdit(g)} className="flex-1 bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors">
                 <Pencil size={14} /> Tahrir
               </button>
               <button onClick={() => handleDelete(g.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-2.5 rounded-xl flex items-center justify-center transition-colors">
                 <Trash2 size={16} />
               </button>
             </div>
            
          </div>
          </Fragment>
        ))}
        {groups.length === 0 && (
          <div className="col-span-full text-center py-12 bg-[#161c28] rounded-3xl border border-dashed border-gray-700/50 mt-4">
            <Users className="mx-auto text-gray-500 opacity-40 mb-3 w-12 h-12" />
            <p className="text-gray-400 font-medium text-lg">Guruhlar mavjud emas</p>
          </div>
        )}
      </div>

      {modalVisible && (
        <div className="app-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-tgBg rounded-3xl p-4 w-full max-w-sm shadow-2xl border border-gray-500/10 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-extrabold mb-4 flex items-center gap-2 text-white">
              {formData.id ? <Pencil size={20} className="text-tgButton" /> : <Plus size={20} className="text-tgButton" />}
              {formData.id ? 'Tahrirlash' : 'Yangi Guruh'}
            </h2>
            
            <div className="space-y-2.5">
              <div className="flex gap-2">
                <div className="flex-[2]">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Guruh nomi</label>
                  <input 
                    type="text" 
                    value={formData.nomi}
                    onChange={e => setFormData({...formData, nomi: e.target.value})}
                    className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl px-3 py-2 text-[15px] text-white font-medium outline-none focus:border-blue-500 transition-colors"
                    placeholder="Masalan: 9-A"
                  />
                </div>
                <div className="flex-[1]">
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Kursi</label>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.kurs}
                    onChange={e => setFormData({...formData, kurs: parseInt(e.target.value) || 1})}
                    className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl px-3 py-2 text-[15px] text-white font-medium outline-none focus:border-blue-500 transition-colors text-center"
                    placeholder="1"
                  />
                </div>
              </div>

                              <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">O'qituvchi (Guruh rahbari)</label>
                  <select 
                    value={formData.teacherId || ''}
                    onChange={e => {
                      const selectedTeacher = teachers.find(t => t.id === e.target.value);
                      setFormData({
                        ...formData, 
                        teacherId: e.target.value,
                        sinfRahbariIsmi: selectedTeacher ? selectedTeacher.ismFamiliya : '',
                        sinfRahbariTelefon: selectedTeacher ? (selectedTeacher.telefon || '') : ''
                      });
                    }}
                    className="w-full bg-[#161c28] border border-gray-700/50 rounded-xl px-3 py-2 text-[15px] text-white font-medium outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="">Tanlang</option>
                    {currentGroup?.teacherId && !teachers.some(t=>t.id===currentGroup.teacherId) && <option value={currentGroup.teacherId}>{currentGroup.sinfRahbariIsmi || 'Mavjud rahbar'} · Olib tashlangan (bog‘lanish saqlanadi)</option>}
                    {teachers.map((t: any) => (
                      <option key={t.id} value={t.id} disabled={!t.faolmi && t.id!==currentGroup?.teacherId}>{t.ismFamiliya}{!t.faolmi?' · Bloklangan':''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 block mt-2">Ota-onalar guruhlari (Telegram)</label>
                  <div className="flex gap-2 mb-2"><input aria-label="Telegram guruhini qidirish" value={chatSearch} onChange={e=>setChatSearch(e.target.value)} placeholder="Guruh nomi yoki ID bo'yicha qidirish" className="min-w-0 flex-1 bg-[#161c28] border border-gray-700 rounded-xl px-3 py-2 text-sm text-white"/><button type="button" disabled={chatsLoading} onClick={()=>void refreshChats()} className="text-blue-400 text-xs px-2">{chatsLoading?'Yuklanmoqda…':'Yangilash'}</button></div>
                  <p className="text-xs text-gray-400 mb-2">Bir nechta guruhni belgilang. Tanlangan: {formData.telegramChatIds.length} ta</p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-700/50">
                    {formData.telegramChatIds.filter(id=>!chats.some(c=>c.chatId===id)).map(id=><label key={id} className="flex items-center gap-2 p-3 text-sm text-orange-400"><input type="checkbox" checked onChange={()=>setFormData({...formData,telegramChatIds:formData.telegramChatIds.filter(x=>x!==id)})}/>Oldingi ulanish: {id} (botni qayta ulang)</label>)}
                    {chats.filter((c:any)=>!chatSearch||c.title.toLocaleLowerCase().includes(chatSearch.toLocaleLowerCase())||c.chatId.includes(chatSearch)).map((c:any)=>(
                      <label key={c.chatId} className="flex items-center gap-3 p-3 border-b border-gray-700/30 cursor-pointer text-sm">
                        <input type="checkbox" checked={formData.telegramChatIds.includes(c.chatId)} onChange={e=>setFormData({...formData,telegramChatIds:e.target.checked?[...formData.telegramChatIds,c.chatId]:formData.telegramChatIds.filter(id=>id!==c.chatId)})}/>
                        <span className="min-w-0"><span className="block break-words">{c.title}</span><span className="text-xs text-gray-400">{c.chatId}</span></span>
                      </label>
                    ))}
                    {!chats.length&&<p className="p-3 text-sm text-gray-400">Hali ulangan Telegram guruhi yo‘q.</p>}
                  </div>
                </div>

              <p className="text-xs text-gray-400">Bot qo'shilgan barcha saqlangan guruhlar shu ro'yxatda. Guruh chiqmasa, botdagi Guruh qo'shish orqali tanlang, so'ng Yangilash tugmasini bosing.</p>
              <button type="button" onClick={()=>WebApp.openTelegramLink('https://t.me/bst_davomat_bot?start=groups')} className="text-sm text-blue-400 underline">Bot orqali Telegram guruhini ulash ↗</button>
              {/* Excel Upload Area */}
              <div className="pt-1">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                  O'quvchilar ro'yxati
                  {formData.id && <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Almashtirish</span>}
                </label>
                <div className={`border-2 border-dashed rounded-xl p-3 text-center transition-colors relative overflow-hidden group ${importFile ? 'border-green-500/50 bg-green-500/5' : 'border-gray-600/50 bg-[#161c28] hover:border-blue-500/50'}`}>
                  <input 
                    type="file" 
                    accept=".xlsx" 
                    onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center pointer-events-none">
                    {importFile ? (
                      <>
                        <FileSpreadsheet size={20} className="text-green-500 mb-1" />
                        <p className="text-[13px] font-bold text-green-500 px-2 truncate w-full">{importFile.name}</p>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={20} className="text-gray-400 mb-1 group-hover:text-blue-400 transition-colors" />
                        <p className="text-[13px] font-bold text-blue-400">Excel (.xlsx) tanlang</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-5">
              <button 
                onClick={() => setModalVisible(false)} 
                disabled={isSaving}
                className="flex-[1] py-2.5 rounded-xl bg-[#161c28] text-gray-400 font-bold hover:bg-[#1e2532] transition-colors border border-gray-700/30 disabled:opacity-50"
              >
                Bekor
              </button>
              <button 
                onClick={saveForm} 
                disabled={isSaving}
                className="flex-[2] py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)] flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : (importFile ? <UploadCloud size={16} /> : null)}
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}

      {qrModalVisible && activeGroup && (
        <div className="app-overlay fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-[999]">
          <div className="bg-white p-6 rounded-3xl max-w-sm w-full flex flex-col items-center relative shadow-2xl">
            <button 
              onClick={() => setQrModalVisible(false)} 
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            >
              ✕
            </button>
            
            <div className="w-12 h-1 bg-gray-200 rounded-full mb-6"></div>
            
            <h2 className="text-black font-extrabold text-2xl mb-1 text-center">{activeGroup.nomi}</h2>
            <p className="text-gray-500 text-sm mb-6 font-medium bg-gray-100 px-3 py-1 rounded-full">Guruh QR kodi</p>
            
            <div className="bg-gray-50 p-2 rounded-2xl mb-8">
              <img src={activeGroup.qrCodeImageUrl} alt="QR Code" className="w-64 h-64 object-contain mix-blend-multiply" />
            </div>
            
            <button 
              onClick={downloadQr} 
              disabled={sendingQr}
              className="w-full py-4 bg-[#0088cc] text-white rounded-2xl font-bold flex justify-center items-center gap-2 active:scale-95 transition-transform disabled:opacity-70 shadow-lg shadow-[#0088cc]/30 text-lg"
            >
              {sendingQr ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Yuborilmoqda...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.11.03-1.9 1.21-3.64 2.39-.25.17-.48.26-.69.25-.23-.01-.68-.13-.99-.24-.41-.14-.73-.22-.71-.47.01-.13.17-.26.48-.4 1.86-.81 4.14-1.78 6.84-2.91 1.29-.54 1.56-.63 1.74-.63.04 0 .12.01.17.04.04.03.07.07.09.12.02.05.02.12.01.18z"/></svg>
                  Bot orqali qabul qilish
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {deletingStudent && (
        <div role="dialog" aria-modal="true" aria-label="O'quvchini o'chirish" className="app-overlay fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[1000]">
          <div className="bg-[#161c28] border border-gray-700 rounded-2xl p-5 max-w-sm w-full">
            <h2 className="font-bold text-white mb-3">O'quvchini o'chirish</h2>
            <p className="text-sm text-gray-300 break-words">{deletingStudent.ismFamiliya} ro'yxatdan o'chirilsinmi? Uning avvalgi davomat yozuvlari ham o'chadi. Bu amalni bekor qilib bo'lmaydi.</p>
            <div className="flex gap-3 mt-5">
              <button disabled={studentBusy} onClick={() => setDeletingStudent(null)} className="flex-1 py-3 rounded-xl bg-gray-700 text-white disabled:opacity-50">Bekor</button>
              <button disabled={studentBusy} onClick={() => void removeStudent()} className="flex-1 py-3 rounded-xl bg-red-600 text-white disabled:opacity-50">{studentBusy ? "O'chirilmoqda…" : "Ha, o'chirish"}</button>
            </div>
          </div>
        </div>
      )}

      {viewingGroup && (
        <div className="app-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[999]">
          <div className="bg-[#161c28] rounded-3xl p-5 w-full max-w-md shadow-2xl border border-gray-700/50 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-white">{viewingGroup.nomi}</h2>
                  <p className="text-sm text-gray-400">O'quvchilar ro'yxati</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowAddForm(!showAddForm)} className={`p-2 rounded-full transition-colors ${showAddForm ? 'bg-tgButton text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  </button>
                  <button disabled={studentBusy} onClick={() => { setViewingGroup(null); setEditingStudent(null); setDeletingStudent(null); }} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              </div>

              {showAddForm && (
                <form onSubmit={handleAddStudent} className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="Ism familiya (Qo'lda qo'shish)"
                    className="flex-1 bg-[#1e2532] border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                  <button 
                    type="submit" 
                    disabled={!newStudentName.trim() || isAddingStudent}
                    className="bg-tgButton text-tgButtonText px-4 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center shrink-0"
                  >
                    {isAddingStudent ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Qo\'shish'}
                  </button>
                </form>
              )}
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {studentsLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-tgButton"></div>
                </div>
              ) : groupStudents.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  <Users className="mx-auto text-gray-600 opacity-40 mb-3 w-10 h-10" />
                  <p>O'quvchilar kiritilmagan</p>
                </div>
              ) : (
                groupStudents.map((s, index) => (
                  <div key={s.id} className="bg-[#1e2532] p-3 rounded-xl flex items-center border border-gray-700/30">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center text-xs mr-3 shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingStudent === s.id ? (
                        <form onSubmit={e => { e.preventDefault(); void saveStudent(s.id); }} className="space-y-2">
                          <input autoFocus aria-label="O'quvchi ism familiyasi" maxLength={200} value={editedName} onChange={e => setEditedName(e.target.value)} disabled={studentBusy} className="w-full min-w-0 rounded-lg bg-gray-900 border border-blue-500 px-2 py-2 text-sm text-white" />
                          <div className="flex gap-3 text-xs">
                            <button type="submit" disabled={studentBusy || !editedName.trim()} className="text-blue-400 disabled:opacity-50">{studentBusy ? 'Saqlanmoqda…' : 'Saqlash'}</button>
                            <button type="button" disabled={studentBusy} onClick={() => setEditingStudent(null)} className="text-gray-400">Bekor</button>
                          </div>
                        </form>
                      ) : <p className="text-sm font-bold text-gray-200 break-words">{s.ismFamiliya}</p>}
                    </div>
                    {editingStudent !== s.id && <div className="flex shrink-0 ml-1">
                      <button type="button" disabled={studentBusy} aria-label={s.ismFamiliya + ' — tahrirlash'} title="Tahrirlash" onClick={() => { setEditingStudent(s.id); setEditedName(s.ismFamiliya); }} className="p-2 text-blue-400 disabled:opacity-50"><Pencil size={18} /></button>
                      <button type="button" disabled={studentBusy} aria-label={s.ismFamiliya + " — o'chirish"} title="O'chirish" onClick={() => setDeletingStudent(s)} className="p-2 text-red-400 disabled:opacity-50"><Trash2 size={18} /></button>
                    </div>}
                  </div>
                ))
              )}
            </div>
            
            <button disabled={studentBusy} onClick={() => { setViewingGroup(null); setEditingStudent(null); setDeletingStudent(null); }} className="mt-4 w-full bg-gray-700/50 hover:bg-gray-700 text-white py-3 rounded-xl font-bold transition-colors">
              Yopish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

