import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, X, Users, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { API_BASE, getHeaders } from '../App';

export default function History() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');
  
  // Modal state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  // Date picker state
  const getLocalYMD = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const [selectedDate, setSelectedDate] = useState<string>(getLocalYMD());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 

  const handleSelectDate = (day: number) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
    setShowDatePicker(false);
  };

  const handleSetToday = () => {
    const d = new Date();
    setCurrentMonth(d);
    setSelectedDate(getLocalYMD());
    setShowDatePicker(false);
  };

  const monthNames = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const fetchHistory = async (date: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/attendance/teacher-sessions?date=${date}`, {
        headers: getHeaders()
      });
      if (!res.ok)throw new Error((await res.json()).message || 'Tarix yuklanmadi.');
      setSessions(await res.json());
    } catch (e:any) {
      setError(e.message || 'Tarmoq xatosi.');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(selectedDate);
  }, [selectedDate]);
  
  const openDetails = async (id: string) => {
    setSelectedSessionId(id);
    setDetailsLoading(true);
    setSessionDetails(null);
    try {
      const res = await fetch(`${API_BASE}/attendance/teacher-sessions/${id}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSessionDetails(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleDateString('uz-UZ', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return d.toLocaleTimeString('uz-UZ', {
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80"></div>
        <p className="text-tgHint font-medium">Tarix yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-6 pb-24 animate-in fade-in slide-in-from-bottom-4 relative">
      {error && <div role="alert" className="p-4 mb-4 bg-red-500/10 text-red-400 rounded-xl"><p>{error}</p><button onClick={()=>void fetchHistory(selectedDate)} className="underline mt-2">Qayta yuklash</button></div>}
      {/* Header & Date Picker */}
      <div className="flex flex-col gap-4 mb-6 px-1">
        <h2 className="text-2xl font-extrabold flex items-center gap-2 text-tgText tracking-tight">
          Hisobotlar tarixi
        </h2>
        
        <div 
          onClick={() => setShowDatePicker(true)}
          className="bg-tgSecondaryBg rounded-2xl p-2 px-3 flex items-center shadow-sm  cursor-pointer active:scale-95 transition-transform"
        >
          <div className="bg-blue-500/10 p-2 rounded-xl text-blue-500 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div className="text-tgText font-bold text-[17px] ml-4 flex-1">
            {new Date(selectedDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {showDatePicker && (
        <div className="app-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-tgBg  rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 flex items-center justify-between  bg-tgSecondaryBg">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-tgHint/10 rounded-xl transition-colors text-tgText">
                <ChevronLeft size={20} />
              </button>
              <span className="font-bold text-lg text-tgText">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button onClick={handleNextMonth} className="p-2 hover:bg-tgHint/10 rounded-xl transition-colors text-tgText">
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-tgHint py-1">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-10 w-full" />
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
                        ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 
                          isToday ? 'bg-blue-500/20 text-blue-500 ' : 
                          'text-tgText hover:bg-tgSecondaryBg'}`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 pt-2  flex gap-2">
              <button onClick={() => setShowDatePicker(false)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-tgSecondaryBg text-tgHint hover:text-tgText transition-colors">
                Yopish
              </button>
              <button onClick={handleSetToday} className="flex-1 py-3 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-lg hover:bg-blue-500 transition-colors">
                Bugun
              </button>
            </div>
          </div>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="text-center text-tgHint mt-10">
          Bu kunda hisobotlar yo'q
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div 
              key={session.id} 
              onClick={() => openDetails(session.id)}
              className="bg-tgSecondaryBg rounded-2xl p-4 shadow-sm relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="absolute top-0 right-0 p-2 bg-green-500/10 text-green-500 rounded-bl-xl text-xs font-bold flex items-center">
                <CheckCircle2 size={14} className="mr-1" /> Yakunlangan
              </div>
              
              <div className="pr-20 mb-3">
                <h3 className="font-bold text-lg text-tgText leading-tight">{session.group?.nomi || 'Guruh'}</h3>
              </div>
              
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center text-xs sm:text-sm text-tgHint">
                  <div className="flex items-center mr-3">
                    <Calendar size={14} className="mr-1.5" />
                    {formatDate(session.sana)}
                  </div>
                  <div className="flex items-center">
                    <Clock size={14} className="mr-1.5" />
                    {formatTime(session.created_at)}
                  </div>
                </div>
                
                {(session.fanNomi || session.customFanNomi) && (
                  <div className="bg-blue-500/10 text-blue-500 rounded-lg px-2 py-1 text-xs font-bold flex items-center shrink-0 ml-2">
                    {session.fanNomi || session.customFanNomi}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Hisobot tafsiloti modal */}
      {selectedSessionId && (
        <div className="app-overlay fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-tgBg w-full sm:w-[400px] h-[85vh] sm:h-[80vh] sm:rounded-3xl rounded-t-3xl flex flex-col shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="p-4  flex items-center justify-between bg-tgSecondaryBg sm:rounded-t-3xl rounded-t-3xl">
              <h3 className="font-bold text-lg">Hisobot tafsiloti</h3>
              <button 
                onClick={() => setSelectedSessionId(null)}
                className="p-2 bg-tgBg rounded-full text-tgHint active:bg-tgHint/20"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
                {detailsLoading ? (
                   <div className="flex justify-center items-center h-40">
                     <div className="w-8 h-8 border-t-2 border-b-2 border-tgButton opacity-80 rounded-full animate-spin"></div>
                   </div>
                ) : sessionDetails ? (
                <div className="space-y-6">
                  {/* Info Header */}
                  <div className="bg-tgSecondaryBg p-4 rounded-2xl ">
                    <h2 className="text-xl font-bold text-tgText">
                      {sessionDetails.group?.nomi || 'Guruh'}
                    </h2>
                    {(sessionDetails.fanNomi || sessionDetails.customFanNomi) && (
                      <span className="inline-block mt-1.5 px-2.5 py-1 bg-blue-500/10 text-blue-500 text-sm font-bold rounded-lg mb-1">
                        {sessionDetails.fanNomi || sessionDetails.customFanNomi}
                      </span>
                    )}
                    <div className="flex flex-wrap gap-y-2 mt-3 text-sm text-tgHint">
                      <div className="flex items-center w-1/2">
                        <Calendar size={15} className="mr-2" />
                        {formatDate(sessionDetails.sana)}
                      </div>
                      <div className="flex items-center w-1/2">
                        <Clock size={15} className="mr-2" />
                        {formatTime(sessionDetails.created_at)}
                      </div>
                      <div className="flex items-center w-1/2 mt-2">
                        <Users size={15} className="mr-2" />
                        {sessionDetails.records?.length || 0} o'quvchi
                      </div>
                    </div>
                  </div>
                  
                  {/* Records List */}
                  <div>
                    <h3 className="font-bold text-tgHint text-sm uppercase mb-3 px-1">O'quvchilar holati</h3>
                    <div className="space-y-2">
                      {sessionDetails.records?.map((record: any, index: number) => {
                        const holatLower = (record.holat || '').toLowerCase();
                        const isPresent = holatLower === 'bor';
                        const isSababli = holatLower === 'sababli';
                        return (
                          <div key={record.id} className="flex items-center justify-between bg-tgSecondaryBg p-3 rounded-xl">
                            <div className="flex items-center overflow-hidden">
                              <div className="font-medium text-tgHint w-6 text-sm">{index + 1}.</div>
                              <div className="font-medium text-tgText truncate">
                                {record.student?.ismFamiliya || 'Noma\'lum o\'quvchi'}
                              </div>
                            </div>
                            <div className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                              isPresent ? 'bg-green-500/10 text-green-500' :
                              isSababli ? 'bg-yellow-500/10 text-yellow-500' :
                              'bg-red-500/10 text-red-500'
                            }`}>
                              {isPresent ? 'Bor' : isSababli ? 'Sababli' : 'Yo\'q'}
                            </div>
                          </div>
                        );
                      })}
                      
                      {(!sessionDetails.records || sessionDetails.records.length === 0) && (
                        <div className="text-center text-tgHint text-sm py-4">
                          Ro'yxat bo'sh
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Photos List */}
                  {sessionDetails.rasmlar && JSON.parse(sessionDetails.rasmlar).length > 0 && (
                    <div>
                      <h3 className="font-bold text-tgHint text-sm uppercase mb-3 px-1">Daliliy Rasmlar</h3>
                      <div className="grid grid-cols-2 gap-3 pb-2">
                        {JSON.parse(sessionDetails.rasmlar).map((rasm: string, i: number) => {
                          const fileName = rasm.split(/[\\/]/).pop();
                          const imgUrl = /^https:\/\//.test(rasm) ? rasm : `${API_BASE.replace('/api', '')}/uploads/photos/${fileName}`;
                          return (
                            <div 
                              key={i} 
                              onClick={() => setFullscreenPhoto(imgUrl)}
                              className="aspect-[3/4] rounded-2xl overflow-hidden bg-tgSecondaryBg shadow-sm  cursor-pointer active:scale-95 transition-transform"
                            >
                              <img src={imgUrl} className="w-full h-full object-cover" alt={`Dalil ${i+1}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-red-500 mt-10">Ma'lumot topilmadi</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen Photo */}
      {fullscreenPhoto && (
        <div 
          className="app-overlay fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-200" 
          onClick={() => setFullscreenPhoto(null)}
        >
          <button 
            className="app-viewer-close absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full active:bg-white/20 transition-colors" 
            onClick={() => setFullscreenPhoto(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={fullscreenPhoto} 
            className="max-w-full max-h-full rounded-lg object-contain animate-in zoom-in-95 duration-200" 
            onClick={(e) => e.stopPropagation()} 
            alt="Fullscreen view" 
          />
        </div>
      )}

      <div className="flex justify-center mt-6 mb-4">
        <a href="https://provveb.uz" target="_blank" rel="noopener noreferrer" className="text-tgHint text-xs font-medium hover:text-tgText transition-colors">
          by provveb.uz / samir
        </a>
      </div>
    </div>
  );
}

