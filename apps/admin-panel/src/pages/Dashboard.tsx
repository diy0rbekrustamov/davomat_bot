import { useEffect, useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import WebApp from '../telegram';
import { api } from '../api';
import { Users, ArrowRight, UserCheck, Activity, Check, Clock as ClockIcon, X, LayoutDashboard, History, ChevronRight, CheckCircle2, Clock, MoreVertical, Shield } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = WebApp.initDataUnsafe?.user;
  const [stats, setStats] = useState({ groups: 0, teachers: 0 });
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState({ completed: 0, missing: 0 });
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { groups, teachers, statusList } = await api.getDashboard();

        setStats({
          groups: Array.isArray(groups) ? groups.length : 0,
          teachers: Array.isArray(teachers) ? teachers.length : 0
        });

        if (Array.isArray(statusList)) {
          let allSessions: any[] = [];
          let completed = 0;
          let missing = 0;

          statusList.forEach(item => {
            if (item.hasSubmittedToday) completed++;
            else missing++;

            if (item.sessions) {
              const mapped = item.sessions.map((s: any) => ({
                ...s,
                groupName: item.nomi
              }));
              allSessions = [...allSessions, ...mapped];
            }
          });
          
          allSessions.sort((a, b) => new Date(b.sana).getTime() - new Date(a.sana).getTime());
          setRecentSessions(allSessions.slice(0, 5));
          setActivityStats({ completed, missing });
        }
      } catch (e: any) {
        WebApp.showAlert(e.message || 'Ma’lumotlar yuklanmadi');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const totalActivity = activityStats.completed + activityStats.missing;
  const percentComplete = totalActivity === 0 ? 0 : Math.round((activityStats.completed / totalActivity) * 100);

  // SVG Chart values
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentComplete / 100) * circumference;

  const getTodayDateString = () => {
    return new Date().toLocaleDateString('uz-UZ', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80"></div>
        <p className="text-tgHint font-medium">Ma'lumotlar yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="p-4 pb-28 app-page overflow-x-hidden">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-50">
        <div>
          <h1 className="text-2xl font-extrabold text-tgText tracking-tight">Boshqaruv</h1>
          <p className="text-tgHint text-sm mt-1 font-medium flex items-center gap-1.5">
            Xush kelibsiz, <span className="text-tgText">{user?.first_name || 'Admin'}</span> 👋
          </p>
        </div>
        
        <button 
          onClick={() => navigate('/admins')} 
          className="w-12 h-12 bg-tgSecondaryBg/60 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-sm border border-gray-500/10 active:scale-95 transition-transform text-tgHint hover:text-tgText md:hidden"
        >
          <Shield size={24} />
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6 mt-2">
        {/* Active Groups Card */}
        <NavLink to="/groups" className="relative overflow-hidden bg-gradient-to-br from-[#1E75FF] to-[#0A45B8] p-5 rounded-3xl shadow-[0_8px_20px_rgba(30,117,255,0.3)] group active:scale-95 transition-transform">
          {/* Decorative Circle */}
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full"></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Users size={20} className="text-white" />
            </div>
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/20 transition-colors">
              <ArrowRight size={14} className="text-white opacity-80" />
            </div>
          </div>
          
          <div className="relative z-10">
            <p className="text-blue-100 text-[13px] font-semibold mb-1">Barcha Guruhlar</p>
            <h3 className="text-4xl font-extrabold text-white mb-2">{stats.groups}</h3>
          </div>
        </NavLink>

        {/* Teachers Card */}
        <NavLink to="/teachers" className="relative overflow-hidden bg-gradient-to-br from-[#10B981] to-[#047857] p-5 rounded-3xl shadow-[0_8px_20px_rgba(16,185,129,0.3)] group active:scale-95 transition-transform">
          {/* Decorative Circle */}
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/10 rounded-full"></div>
          
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <UserCheck size={20} className="text-white" />
            </div>
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/20 transition-colors">
              <ArrowRight size={14} className="text-white opacity-80" />
            </div>
          </div>
          
          <div className="relative z-10">
            <p className="text-emerald-100 text-[13px] font-semibold mb-1">Barcha O'qituvchilar</p>
            <h3 className="text-4xl font-extrabold text-white mb-2">{stats.teachers}</h3>
          </div>
        </NavLink>
      </div>

      {/* Today's Activity Card */}
      <NavLink to="/history" className="block bg-[#161c28] rounded-3xl p-5 shadow-lg border border-gray-700/30 active:scale-[0.98] transition-transform mb-8">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-full bg-[#1e2532] flex items-center justify-center">
            <Activity size={22} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-[17px] leading-tight mb-0.5">Bugungi Faoliyat</h3>
            <p className="text-gray-400 text-xs font-medium">{getTodayDateString()}</p>
          </div>
        </div>

        <div className="flex items-center">
          
          {/* Left Stats Column */}
          <div className="flex-1 pr-2 space-y-0">
            
            <div className="flex items-center justify-between py-3 border-b border-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                  <Check size={14} className="text-white stroke-[3]" />
                </div>
                <span className="text-gray-300 text-sm font-medium">Yakunlangan</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white font-bold text-sm">{activityStats.completed}</span>
                <span className="text-blue-400 text-xs font-bold w-8 text-right">{percentComplete}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#f59e0b] flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                  <ClockIcon size={14} className="text-white stroke-[3]" />
                </div>
                <span className="text-gray-300 text-sm font-medium">Kutilayotgan</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white font-bold text-sm">{activityStats.missing}</span>
                <span className="text-blue-400 text-xs font-bold w-8 text-right">{100 - percentComplete}%</span>
              </div>
            </div>

          </div>

          {/* Right Chart Column */}
          <div className="w-[110px] flex items-center justify-center pl-2">
            <div className="relative w-24 h-24">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                {/* Background Track */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="8"
                />
                {/* Progress Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="url(#progressGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Inner Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-white text-[19px] font-extrabold leading-none mb-1">{percentComplete}%</span>
                <span className="text-gray-400 text-[7px] uppercase tracking-wider leading-tight w-12">Davomat Holati</span>
              </div>
            </div>
          </div>

        </div>
      </NavLink>

      {/* Recent Sessions List */}
      <div>
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <History size={18} className="text-tgHint" />
            <h3 className="font-extrabold text-lg">So'nggi xisobotlar</h3>
          </div>
          <NavLink to="/history" className="text-tgButton text-xs font-bold uppercase tracking-wider flex items-center">
            Barchasi <ChevronRight size={14} />
          </NavLink>
        </div>

        {recentSessions.length === 0 ? (
          <div className="bg-tgSecondaryBg/20 rounded-3xl p-8 border border-dashed border-gray-500/20 text-center">
            <Clock size={32} className="mx-auto text-tgHint opacity-30 mb-3" />
            <p className="text-tgHint font-medium text-sm">Bugun hali xisobotlar topshirilmadi</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((s, idx) => (
              <NavLink 
                to="/history" 
                key={s.id || idx} 
                className="bg-tgSecondaryBg/40 backdrop-blur-sm p-4 rounded-2xl flex items-center justify-between active:scale-95 transition-transform border border-gray-500/5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 size={20} className="text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm mb-0.5">{s.groupName}</h4>
                    <p className="text-xs font-medium text-tgHint">{s.fanNomi}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-tgText/70 bg-gray-500/10 px-2 py-1 rounded-lg">
                    {new Date(s.yakunlanganVaqt || s.sana).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
              </NavLink>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-center mt-6 mb-8">
        <a href="https://provveb.uz" target="_blank" rel="noopener noreferrer" className="text-tgHint text-xs font-medium hover:text-tgButton transition-colors">
          by provveb.uz / samir
        </a>
      </div>
    </div>
  );
}
