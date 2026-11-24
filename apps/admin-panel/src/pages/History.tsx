import { useEffect, useState } from 'react';
import { api } from '../api';
import WebApp from '../telegram';
import { Calendar, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Clock, Trash2, Camera, CalendarDays, Loader2 } from 'lucide-react';

export default function History() {
  const developer=String(WebApp.initDataUnsafe?.user?.id)==='8197301287';
  const [deletions,setDeletions]=useState<any[]>([]);
  const [deleteStatusError,setDeleteStatusError]=useState('');
  const [retrying,setRetrying]=useState<string|null>(null);
  const refreshDeletions=async()=>{try{setDeletions(await api.getReportDeletions());setDeleteStatusError('');}catch(error:any){setDeleteStatusError(error.message||'O‘chirish holati yuklanmadi');}};
  useEffect(()=>{void refreshDeletions();},[]);
  const hasPendingDeletions=deletions.some(job=>job.status==='ATTENDANCE_DELETE_PENDING');
  useEffect(()=>{if(!hasPendingDeletions)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')void refreshDeletions();},5000);return()=>clearInterval(timer);},[hasPendingDeletions]);
  const openArchive=async(id:string)=>{setSelectedSession(id);setLoadingDetails(true);try{setSessionDetails(await api.getReportArchive(id));}catch(error:any){WebApp.showAlert(error.message);setSelectedSession(null);}finally{setLoadingDetails(false);}};
  const [statusList, setStatusList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState<string>(getLocalYMD());

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingAttendance,setEditingAttendance]=useState(false);
  const [draftRecords,setDraftRecords]=useState<Record<string,string>>({});
  const [editBusy,setEditBusy]=useState(false);
  const [editError,setEditError]=useState('');
  useEffect(()=>{setEditingAttendance(false);setEditError('');},[selectedSession]);
  useEffect(()=>{if(!selectedSession||sessionDetails?.correction?.status!=='ATTENDANCE_EDIT_PENDING')return;const timer=setInterval(()=>{void api.getSessionById(selectedSession).then(setSessionDetails).catch(()=>{});},5000);return()=>clearInterval(timer);},[selectedSession,sessionDetails?.correction?.status]);
  const saveAttendance=async()=>{if(editBusy)return;setEditBusy(true);setEditError('');try{const result=await api.editAttendance(sessionDetails.id,sessionDetails.records.map((r:any)=>({studentId:r.studentId,holat:draftRecords[r.studentId]||r.holat})),sessionDetails.editRevision||'');setSessionDetails({...result.session,editRevision:result.correction.revision,correction:result.correction});setEditingAttendance(false);await fetchStatus(selectedDate);}catch(e:any){setEditError(e.message);}finally{setEditBusy(false);}};


  const fetchStatus = async (date: string) => {
    setLoading(true);
    try {
      const data = await api.getTodayStatus(date);
      setStatusList(data);
    } catch (e: any) {
      WebApp.showAlert(e.message || 'Xatolik yuz berdi');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus(selectedDate);
  }, [selectedDate]);

  const openSessionDetails = async (id: string) => {
    setSelectedSession(id);
    setLoadingDetails(true);
    try {
      const data = await api.getSessionById(id);
      setSessionDetails(data);
    } catch (e: any) {
      WebApp.showAlert(e.message || "Xatolik yuz berdi");
      setSelectedSession(null);
    }
    setLoadingDetails(false);
  };

  const closeModal = () => {
    setSelectedSession(null);
    setSessionDetails(null);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  
  // Adjust so Monday is 0, Sunday is 6
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSelectDate = (day: number) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    // Format YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setShowDatePicker(false);
  };

  const handleSetToday = () => {
    const d = new Date();
    setCurrentMonth(d);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setShowDatePicker(false);
  };

  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
  const dayNames = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

  if (loading && statusList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80"></div>
        <p className="text-tgHint font-medium">Xisobotlar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-24">
      {/* Header & Date Picker */}
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
           Xisobotlar
        </h1>
        
        <div 
          onClick={() => setShowDatePicker(true)}
          className="bg-[#161c28] rounded-2xl p-2 px-3 flex items-center border border-gray-700/30 shadow-lg hover:border-gray-600/50 transition-colors cursor-pointer"
        >
          <div className="bg-[#1e2532] p-2 rounded-xl text-blue-400 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="text-white font-bold text-[17px] ml-4 flex-1">
            {new Date(selectedDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {(deletions.length>0||deleteStatusError) && <section className="mb-6 rounded-2xl border border-gray-700/50 p-4 bg-[#161c28] space-y-3">
        <h2 className="font-bold text-white">O‘chirish holati {developer?'va shaxsiy arxiv':''}</h2>
        <p className="text-xs text-gray-400">Developer arxivi har doim saqlanadi. Telegram ruxsati yoki xabar yoshi cheklovi bo‘lsa, bu yerda ko‘rsatiladi.</p>
        {deleteStatusError&&<button onClick={()=>void refreshDeletions()} className="text-sm text-red-400">{deleteStatusError} · Yangilash</button>}
        {deletions.map(job=><div key={job.id} className="border-t border-gray-700/50 pt-3 text-sm space-y-1">
          <div className="font-bold text-white break-words">{job.groupName}</div>
          <p className={job.status==='ATTENDANCE_DELETE_DONE'?'text-green-400':job.status==='ATTENDANCE_DELETE_PARTIAL'?'text-red-400':'text-blue-400'}>{job.status==='ATTENDANCE_DELETE_DONE'?'Boshqa joylardagi barcha saqlangan nusxalar o‘chirildi':job.status==='ATTENDANCE_DELETE_PARTIAL'?'To‘liq o‘chirilmadi — cheklov bor':'O‘chirish navbatda'} · {job.deleted}/{job.total}</p>
          <p className="text-xs text-gray-400">{job.archiveSaved?'Developer arxivi saqlandi':'Developer arxivi tayyorlanmoqda'}</p>
          {job.waiting==='SENDING_FINISH'&&<p className="text-xs text-gray-400">Boshlangan yuborish tugashi kutilmoqda.</p>}
          {job.waiting==='ARCHIVE_FAILED'&&<p className="text-xs text-red-400">Developer arxivini yuborib bo‘lmadi. Qolgan nusxalar hozircha saqlanmoqda.</p>}
          {job.failed>0&&<p className="text-xs text-red-400">{job.failed} ta xabarga Telegram o‘chirish ruxsatini bermadi.</p>}
          {job.unknownChats?.length>0&&<p className="text-xs text-red-400">{job.unknownChats.length} ta manzilda eski yoki tasdiqlanmagan xabar IDsi yo‘q. Bu nusxalarni avtomatik o‘chirish kafolatlanmaydi.</p>}
          <div className="flex gap-4 pt-1">
            {job.status==='ATTENDANCE_DELETE_PARTIAL'&&<button disabled={retrying===job.sessionId} onClick={async()=>{setRetrying(job.sessionId);try{await api.retryReportDeletion(job.sessionId);await refreshDeletions();}catch(error:any){WebApp.showAlert(error.message);}finally{setRetrying(null);}}} className="text-blue-400 disabled:opacity-50">{retrying===job.sessionId?'Kutilmoqda…':'Qayta urinish'}</button>}
            {developer&&<button onClick={()=>void openArchive(job.sessionId)} className="text-blue-400">Arxivni ko‘rish</button>}
          </div>
        </div>)}
      </section>}

      {showDatePicker && (
        <div className="app-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#161c28] border border-gray-700/50 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animation-fade-in">
            <div className="p-4 flex items-center justify-between border-b border-gray-700/50 bg-[#1e2532]/50">
              <button onClick={handlePrevMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-700/20 text-gray-300 hover:bg-gray-700/40 transition-colors">
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h2>
              <button onClick={handleNextMonth} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-700/20 text-gray-300 hover:bg-gray-700/40 transition-colors">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {dayNames.map(day => (
                  <div key={day} className="text-[11px] font-bold text-gray-500 uppercase tracking-wider py-1">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10"></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const isSelected = selectedDate === `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isToday = new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayNum).toDateString();
                  
                  return (
                    <button
                      key={dayNum}
                      onClick={() => handleSelectDate(dayNum)}
                      className={`h-10 w-full rounded-xl flex items-center justify-center text-sm font-semibold transition-all
                        ${isSelected ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 
                          isToday ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 
                          'text-gray-300 hover:bg-[#1e2532]'}`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 pt-2 border-t border-gray-700/50 flex gap-2">
              <button onClick={() => setShowDatePicker(false)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-gray-700/20 text-gray-300 hover:bg-gray-700/30 transition-colors">
                Yopish
              </button>
              <button onClick={handleSetToday} className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:bg-blue-500 transition-colors">
                Bugun
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statusList.map(item => (
          <div key={item.id} className="bg-[#161c28] p-5 rounded-3xl border border-gray-700/30 shadow-lg overflow-hidden transition-all hover:border-gray-600/50">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-extrabold text-[18px] text-white">{item.nomi}</h3>
                <p className="text-xs text-gray-400 mt-1">Sinf rahbari: {item.sinfRahbariIsmi}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5
                ${item.hasSubmittedToday ? 'bg-[#22c55e]/15 text-[#22c55e]' : 'bg-[#f59e0b]/15 text-[#f59e0b]'}`}
              >
                {item.hasSubmittedToday ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                {item.hasSubmittedToday ? 'Yakunlangan' : 'Kutilmoqda'}
              </div>
            </div>

            {item.sessions && item.sessions.length > 0 && (
              <div className="space-y-2 mt-5 pt-4 border-t border-gray-700/50">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-2">Shu kundagi darslar</p>
                {item.sessions.map((s: any) => (
                  <button 
                    key={s.id} 
                    onClick={(e) => {
                      e.stopPropagation();
                      openSessionDetails(s.id);
                    }}
                    className="w-full text-left bg-[#1e2532] hover:bg-[#252d3d] p-3.5 rounded-2xl flex justify-between items-center active:scale-95 transition-all border border-gray-700/30 group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-extrabold text-white">{s.fanNomi}</p>
                      </div>
                      <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                        <Clock size={12} className="opacity-70" />
                        {new Date(s.sana).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})} • {s.teacher?.ismFamiliya}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[14px] font-extrabold text-gray-300 bg-gray-800/80 px-2.5 py-1 rounded-xl border border-gray-700/50 shadow-sm">
                        {s.records?.filter((r: any) => r.holat === 'BOR').length || 0}/{s.records?.length || 0}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                        <ChevronRight size={18} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {!loading && statusList.length === 0 && (
          <div className="col-span-full text-center py-12 bg-[#161c28] rounded-3xl border border-dashed border-gray-700/50 mt-4">
            <Calendar className="mx-auto text-gray-500 opacity-40 mb-3 w-12 h-12" />
            <p className="text-gray-400 font-medium text-lg">Bu sanada xisobotlar yo'q</p>
          </div>
        )}
        
        {loading && statusList.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-tgButton opacity-50" />
          </div>
        )}
      </div>

      {/* Modal */}
      {sessionDetails && (
        <div className="app-overlay fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200" onClick={closeModal}>
          <div 
            className="bg-[#161c28] w-full sm:w-[450px] h-[90vh] sm:h-[85vh] sm:rounded-3xl rounded-t-3xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-8 overflow-hidden relative border border-gray-700/50"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar for dragging visual (mobile only) */}
            <div className="md:hidden w-full flex justify-center pt-3 pb-1 absolute top-0 left-0 z-20">
              <div className="w-12 h-1.5 bg-gray-500/30 rounded-full"></div>
            </div>

            {/* Header */}
            <div className="px-6 pt-8 pb-6 relative z-10 border-b border-gray-700 bg-[#161c28] shadow-sm shrink-0">
              <button 
                onClick={closeModal} 
                className="absolute top-6 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-600/20 text-white hover:bg-gray-600/40 active:scale-95 transition-colors"
              >
                ✕
              </button>
              <div className="pr-10">
                <h2 className="font-extrabold text-2xl text-white leading-tight mb-1">{sessionDetails.group?.nomi}</h2>
                <p className="text-sm font-bold text-blue-400 uppercase tracking-wide">{sessionDetails.fanNomi}</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[#0f131c]">
              {/* Stats Cards */}
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1e2532] p-4 rounded-2xl border border-gray-700/50">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">O'qituvchi</p>
                    <p className="font-bold text-[14px] text-white leading-tight">{sessionDetails.teacher?.ismFamiliya}</p>
                  </div>
                  <div className="bg-[#1e2532] p-4 rounded-2xl border border-gray-700/50">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Topshirildi</p>
                    <p className="font-bold text-[14px] text-white">
                      {new Date(sessionDetails.yakunlanganVaqt || sessionDetails.sana).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>
                <div className="bg-[#1e2532] p-4 rounded-2xl border border-gray-700/50 flex justify-between items-center">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Davomat</p>
                    <p className="font-bold text-[14px] text-white">
                      <span className="text-green-400">{sessionDetails.records?.filter((r: any) => r.holat === 'BOR').length || 0} ta bor</span>, <span className="text-red-400">{sessionDetails.records?.filter((r: any) => r.holat === 'YOQ').length || 0} ta yo'q</span>
                    </p>
                  </div>
                  <div className="text-right">
                     <span className="text-[20px] font-extrabold text-white">
                       {sessionDetails.records?.filter((r: any) => r.holat === 'BOR').length || 0}/{sessionDetails.records?.length || 0}
                     </span>
                  </div>
                </div>
              </div>

                {sessionDetails.correction&&<section className="rounded-xl border border-blue-400/30 p-3 text-sm"><p>{sessionDetails.correction.status==='ATTENDANCE_EDIT_DONE'?'Telegram nusxalari bildirishnomasiz yangilandi':sessionDetails.correction.status==='ATTENDANCE_EDIT_PARTIAL'?'Ba’zi Telegram nusxalari tahrirlanmadi — ruxsat yoki eski xabar IDsi cheklovi':'Telegram nusxalari tahrirlanmoqda'} · {sessionDetails.correction.done}/{sessionDetails.correction.total}</p>{developer&&sessionDetails.correction.status==='ATTENDANCE_EDIT_PARTIAL'&&<button disabled={editBusy} className="text-blue-400 p-2" onClick={async()=>{setEditBusy(true);try{await api.retryAttendanceEdit(sessionDetails.id);setSessionDetails(await api.getSessionById(sessionDetails.id));}catch(e:any){setEditError(e.message);}finally{setEditBusy(false);}}}>Qayta urinish</button>}</section>}
                {developer&&!sessionDetails.deletedArchive&&sessionDetails.holat==='YAKUNLANDI'&&<section className="rounded-xl border border-blue-400/30 p-3 space-y-2"><p className="text-sm">Developer: kelgan/kelmagan holatini tahrirlash. Mavjud Telegram nusxalari bildirishnomasiz yangilanadi.</p>{!editingAttendance?<button className="p-2 text-blue-400 font-bold" onClick={()=>{setDraftRecords(Object.fromEntries(sessionDetails.records.map((r:any)=>[r.studentId,r.holat])));setEditingAttendance(true);setEditError('');}}>Davomatni tahrirlash</button>:<div className="flex gap-4"><button disabled={editBusy} className="p-2 text-green-400" onClick={()=>void saveAttendance()}>{editBusy?'Saqlanmoqda…':'Saqlash'}</button><button disabled={editBusy} className="p-2" onClick={()=>setEditingAttendance(false)}>Bekor qilish</button></div>}{editError&&<p role="alert" className="text-red-400 text-sm">{editError}</p>}</section>}
                {/* O'quvchilar ro'yxati */}
                <div>
                  <h3 className="font-bold mb-3 text-[12px] text-gray-400 uppercase tracking-widest ml-1">O'quvchilar holati</h3>
                  <div className="bg-[#1e2532] rounded-3xl border border-gray-700/50 overflow-hidden">
                    {sessionDetails.records?.map((r: any, idx: number) => (
                      <div key={r.id} className={`flex justify-between items-center py-3.5 px-4 ${idx !== sessionDetails.records.length - 1 ? 'border-b border-gray-700/50' : ''}`}>
                        <span className="text-sm font-semibold text-white">{r.student?.ismFamiliya}</span>
                        <span className={`text-[10px] font-bold px-3 py-1.5 uppercase tracking-wider rounded-lg shadow-sm
                          ${r.holat === 'BOR' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 
                            r.holat === 'SABABLI' ? 'bg-[#f59e0b]/20 text-[#f59e0b]' : 
                            'bg-[#ef4444]/20 text-[#ef4444]'}`}>
                          {r.holat}
                        </span>
                        {editingAttendance&&<select aria-label={r.student.ismFamiliya+' — davomat'} disabled={editBusy} className="bg-[#161c28] p-2 rounded text-white" value={draftRecords[r.studentId]||r.holat} onChange={e=>setDraftRecords(prev=>({...prev,[r.studentId]:e.target.value}))}><option value="BOR">BOR</option><option value="YOQ">YO‘Q</option></select>}
                      </div>
                    ))}
                    {(!sessionDetails.records || sessionDetails.records.length === 0) && (
                      <p className="text-sm text-center py-6 text-gray-400 font-medium">O'quvchilar ro'yxati yo'q</p>
                    )}
                  </div>
                </div>

                {/* Yuklangan rasmlar */}
                {(() => {
                  try {
                    const photos = JSON.parse(sessionDetails.rasmlar || '[]');
                    if (photos.length > 0) {
                      return (
                        <div>
                          <h3 className="font-bold mb-3 mt-2 text-[12px] text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                            <Camera size={14} /> Xisobot rasmlari
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {photos.map((p: string, idx: number) => {
                              const filename = p.split(/[\\/]/).pop();
                              const url = /^https:\/\//.test(p) ? p : `/uploads/photos/${filename}`;
                              return (
                                <div key={idx} className="aspect-square rounded-2xl overflow-hidden bg-[#1e2532] border border-gray-700/50 shadow-sm relative group cursor-pointer" onClick={() => setFullScreenImage(url)}>
                                  <img 
                                    src={url} 
                                    alt={`Rasm ${idx+1}`} 
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors"></div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {}
                  return null;
                })()}

                <div className="pt-6 pb-8 mt-4">
                  {!sessionDetails.deletedArchive && <button
                    disabled={isDeleting}
                    onClick={async () => {
                      if (isDeleting) return;
                      WebApp.showConfirm("Hisobot admin va guruhlardan o‘chiriladi. Developerning shaxsiy arxivi saqlanadi. Davom etilsinmi?", async (confirmed) => {
                        if (confirmed) {
                          setIsDeleting(true);
                          try {
                            const result=await api.deleteSession(sessionDetails.id);
                            WebApp.showAlert(result.message);
                            void refreshDeletions();
                            closeModal();
                            fetchStatus(selectedDate);
                          } catch (e: any) {
                            WebApp.showAlert(e.message || "O'chirishda xatolik yuz berdi");
                          } finally {
                            setIsDeleting(false);
                          }
                        }
                      });
                    }}
                    className="w-full bg-red-500/10 text-red-500 hover:bg-red-500/20 py-4 rounded-2xl font-bold active:scale-95 transition-all flex items-center justify-center gap-2 border border-red-500/20 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        O'chirilmoqda...
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Xisobotni o'chirish
                      </>
                    )}
                  </button>}
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Full Screen Image Viewer */}
      {fullScreenImage && (
        <div className="app-overlay fixed inset-0 bg-black/95 backdrop-blur-xl z-[110] flex flex-col animation-fade-in">
          <div className="app-viewer-controls p-4 flex justify-end absolute top-0 left-0 right-0 z-10">
            <button 
              onClick={() => setFullScreenImage(null)} 
              className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md hover:bg-white/20 active:scale-95 transition-all"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
            <img 
              src={fullScreenImage} 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              alt="To'liq rasm" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
