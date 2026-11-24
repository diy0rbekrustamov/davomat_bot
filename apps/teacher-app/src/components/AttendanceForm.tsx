import { useState } from 'react';

export default function AttendanceForm({ data, onNext }: { data: any, onNext: (customSubject: string, records: { studentId: string, holat: string }[]) => void }) {
  const [attendance, setAttendance] = useState<Record<string, boolean>>(
    data.students.reduce((acc: any, student: any) => ({ ...acc, [student.id]: true }), {})
  );
  
  const [subject, setSubject] = useState<string>('');

  const toggleStatus = (id: string) => {
    setAttendance(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSubmit = () => {
    if (!subject.trim()) {
      return;
    }
    const records = data.students.map((s: any) => ({
      studentId: s.id,
      holat: attendance[s.id] ? 'BOR' : 'YOQ'
    }));
    onNext(subject, records);
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const totalCount = data.students.length;

  return (
    <div className="p-4 pb-28">
      {/* Header Card */}
      <div className="bg-[#1e2532] border border-gray-700/50 rounded-3xl p-5 mb-6 shadow-xl relative overflow-hidden">
        {/* Dekorativ element */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex justify-between items-center mb-5 relative z-10">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{data.group.nomi}</h1>
            <p className="text-gray-400 text-xs mt-1 font-medium">{new Date().toLocaleDateString('uz-UZ')}</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-xl">
            <span className="text-blue-400 font-bold text-sm">{totalCount} ta o'quvchi</span>
          </div>
        </div>
        
        <div className="space-y-2 relative z-10">
          <label className="text-xs text-gray-400 font-bold uppercase tracking-wider pl-1">Hozir qaysi fan o'tilyapti? <span className="text-red-400">*</span></label>
          <input 
            type="text" 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)}
            className="w-full bg-[#161c28] text-white placeholder-gray-500 p-3.5 rounded-2xl border border-gray-700/50 focus:outline-none focus:border-blue-500/50 transition-colors text-sm font-medium"
            placeholder="Masalan: Fizika (majburiy)"
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="flex justify-between items-center mb-4 px-2">
        <h2 className="text-gray-300 font-bold text-lg">O'quvchilar</h2>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div> {presentCount} bor
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div> {totalCount - presentCount} yo'q
          </span>
        </div>
      </div>

      {data.students.length === 0 && (
        <div className="bg-[#1e2532] border border-gray-700/50 rounded-3xl p-8 text-center mt-4">
          <p className="text-gray-400 font-medium">Bu guruhda hali o'quvchilar yo'q</p>
        </div>
      )}

      {/* Student List */}
      <div className="space-y-2.5">
        {data.students.map((s: any) => (
          <div 
            key={s.id} 
            onClick={() => toggleStatus(s.id)}
            className={`flex justify-between items-center p-3 rounded-2xl transition-all duration-200 cursor-pointer border ${
              attendance[s.id] 
                ? 'bg-[#1e2532] border-gray-700/50' 
                : 'bg-red-500/5 border-red-500/20'
            }`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
              <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center font-bold text-lg border ${
                attendance[s.id] 
                  ? 'bg-[#161c28] border-gray-700/50 text-green-400' 
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
                {s.ismFamiliya.charAt(0)}
              </div>
              <span className={`font-semibold text-[15px] truncate ${!attendance[s.id] ? 'text-red-400' : 'text-gray-200'}`}>
                {s.ismFamiliya}
              </span>
            </div>
            
            {/* Custom Toggle Switch */}
            <div className={`relative w-14 h-8 shrink-0 rounded-full transition-colors duration-300 ${
              attendance[s.id] ? 'bg-green-500' : 'bg-red-500'
            }`}>
              <div className={`absolute top-1 bottom-1 w-6 bg-white rounded-full transition-transform duration-300 flex items-center justify-center shadow-sm ${
                attendance[s.id] ? 'translate-x-7' : 'translate-x-1'
              }`}>
                {attendance[s.id] ? (
                  <span className="text-green-500 font-bold text-xl leading-none" style={{ marginTop: '-2px' }}>+</span>
                ) : (
                  <span className="text-red-500 font-bold text-xl leading-none" style={{ marginTop: '-4px' }}>-</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Fixed Bottom Action */}
      <div className="app-bottom-action fixed bottom-0 left-0 w-full px-4 pt-1 pb-5 bg-tgBg/90 backdrop-blur-md z-50">
        <div className="flex justify-center mb-3">
          <a href="https://provveb.uz" target="_blank" rel="noopener noreferrer" className="text-tgHint text-xs font-medium hover:text-tgText transition-colors">
            by provveb.uz / samir
          </a>
        </div>
        <button 
          onClick={handleSubmit}
          disabled={!subject.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100 flex justify-center items-center gap-2"
        >
          <span>Davomatni saqlash</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
        </button>
      </div>
    </div>
  );
}

