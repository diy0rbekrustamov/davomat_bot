import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, Users, GraduationCap, BarChart3, MoreVertical, Shield } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Groups from './pages/Groups';
import Teachers from './pages/Teachers';
import History from './pages/History';
import Admins from './pages/Admins';

function App() {

  const mobileNavClass = ({ isActive }: { isActive: boolean }) => 
    `flex flex-col items-center justify-center relative w-16 h-14 transition-all duration-300 ${isActive ? 'text-tgButton' : 'text-tgHint hover:text-gray-300'}`;

  const desktopNavClass = ({ isActive }: { isActive: boolean }) => 
    `flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold text-[15px] ${isActive ? 'bg-tgButton/10 text-tgButton border border-tgButton/20 shadow-sm' : 'text-tgHint hover:bg-gray-500/5 hover:text-gray-300 border border-transparent'}`;

  return (
    <BrowserRouter>
      <div className="app-shell app-admin flex flex-col md:flex-row overflow-hidden bg-tgBg text-tgText max-w-[100vw]">
        
        {/* Sidebar for Desktop */}
        <div className="hidden md:flex flex-col w-[280px] shrink-0 overflow-y-auto min-h-0 bg-tgSecondaryBg/30 backdrop-blur-xl border-r border-gray-500/10 p-6 z-40 shadow-xl">
          <div className="flex items-center gap-3 mb-12 px-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg tracking-tight leading-none">Admin Panel</h2>
              <p className="text-[11px] text-tgHint font-bold uppercase tracking-wider mt-1">Davomat Tizimi</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1">
            <NavLink to="/" className={desktopNavClass}>
              <Home size={22} />
              <span>Bosh sahifa</span>
            </NavLink>
            <NavLink to="/groups" className={desktopNavClass}>
              <Users size={22} />
              <span>Guruhlar</span>
            </NavLink>
            <NavLink to="/teachers" className={desktopNavClass}>
              <GraduationCap size={22} />
              <span>O'qituvchilar</span>
            </NavLink>
            <NavLink to="/history" className={desktopNavClass}>
              <BarChart3 size={22} />
              <span>Hisobotlar</span>
            </NavLink>
          </div>

          <div className="mt-auto pt-6 border-t border-gray-500/10">
            <NavLink to="/admins" className={desktopNavClass}>
              <Shield size={22} />
              <span>Tizim sozlamalari</span>
            </NavLink>
          </div>
        </div>

        {/* Asosiy kontent qismi */}
        <div className="app-admin-content flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pb-24 md:pb-0 relative bg-gradient-to-br from-tgBg to-tgBg/50">
          <div className="w-full md:px-6 min-h-full">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/teachers" element={<Teachers />} />
              <Route path="/admins" element={<Admins />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </div>
        </div>

        {/* Bottom Navigation (Mobile Only) */}
        <div className="app-bottom-nav md:hidden fixed bottom-0 w-full bg-tgSecondaryBg/80 backdrop-blur-xl border-t border-gray-600/20 flex justify-around p-2 pb-5 z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.15)]">
          <NavLink to="/" className={mobileNavClass}>
            {({ isActive }) => (
              <>
                {isActive && <div className="absolute -top-2 w-8 h-1 bg-tgButton rounded-b-full"></div>}
                <div className={`flex flex-col items-center justify-center w-full h-full rounded-xl transition-all ${isActive ? 'bg-tgButton/10' : ''}`}>
                  <Home size={22} className={isActive ? 'animate-bounce-short' : ''} />
                  <span className="text-[10px] mt-1 font-semibold">Asosiy</span>
                </div>
              </>
            )}
          </NavLink>
          <NavLink to="/groups" className={mobileNavClass}>
            {({ isActive }) => (
              <>
                {isActive && <div className="absolute -top-2 w-8 h-1 bg-tgButton rounded-b-full"></div>}
                <div className={`flex flex-col items-center justify-center w-full h-full rounded-xl transition-all ${isActive ? 'bg-tgButton/10' : ''}`}>
                  <Users size={22} className={isActive ? 'animate-bounce-short' : ''} />
                  <span className="text-[10px] mt-1 font-semibold">Guruhlar</span>
                </div>
              </>
            )}
          </NavLink>
          <NavLink to="/teachers" className={mobileNavClass}>
            {({ isActive }) => (
              <>
                {isActive && <div className="absolute -top-2 w-8 h-1 bg-tgButton rounded-b-full"></div>}
                <div className={`flex flex-col items-center justify-center w-full h-full rounded-xl transition-all ${isActive ? 'bg-tgButton/10' : ''}`}>
                  <GraduationCap size={22} className={isActive ? 'animate-bounce-short' : ''} />
                  <span className="text-[10px] mt-1 font-semibold">O'qituvchilar</span>
                </div>
              </>
            )}
          </NavLink>
          <NavLink to="/history" className={mobileNavClass}>
            {({ isActive }) => (
              <>
                {isActive && <div className="absolute -top-2 w-8 h-1 bg-tgButton rounded-b-full"></div>}
                <div className={`flex flex-col items-center justify-center w-full h-full rounded-xl transition-all ${isActive ? 'bg-tgButton/10' : ''}`}>
                  <BarChart3 size={22} className={isActive ? 'animate-bounce-short' : ''} />
                  <span className="text-[10px] mt-1 font-semibold">Hisobot</span>
                </div>
              </>
            )}
          </NavLink>
        </div>

      </div>
    </BrowserRouter>
  );
}

export default App;
