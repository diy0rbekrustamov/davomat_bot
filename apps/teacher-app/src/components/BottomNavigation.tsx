import { BarChart3, ScanLine, User, Users } from 'lucide-react';

interface BottomNavProps {
  activeTab: 'history' | 'scan' | 'profile' | 'groups';
  onChange: (tab: 'history' | 'scan' | 'profile' | 'groups') => void;
}

export default function BottomNavigation({ activeTab, onChange }: BottomNavProps) {
  return (
    <div className="app-bottom-nav app-teacher-nav fixed bottom-0 left-0 right-0 z-50 pb-5 px-5 pointer-events-none">
      <div className="bg-tgSecondaryBg/80 backdrop-blur-xl rounded-full px-4 py-2.5 flex justify-between items-center shadow-[0_8px_30px_rgba(0,0,0,0.12)] pointer-events-auto">
        <button 
          onClick={() => onChange('groups')}
          className={`flex flex-col items-center p-2 transition-all duration-300 ${activeTab === 'groups' ? 'text-blue-500 scale-105' : 'text-tgHint'}`}
        >
          <Users size={22} strokeWidth={activeTab === 'groups' ? 2.5 : 2} />
          <span className={`text-[10px] mt-1.5 ${activeTab === 'groups' ? 'font-bold' : 'font-medium'}`}>Guruhlar</span>
        </button>

        <button 
          onClick={() => onChange('history')}
          className={`flex flex-col items-center p-2 transition-all duration-300 ${activeTab === 'history' ? 'text-blue-500 scale-105' : 'text-tgHint'}`}
        >
          <BarChart3 size={22} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
          <span className={`text-[10px] mt-1.5 ${activeTab === 'history' ? 'font-bold' : 'font-medium'}`}>Hisobotlar</span>
        </button>

        <div className="relative -top-6">
          <button 
            onClick={() => onChange('scan')}
            className={`flex items-center justify-center w-14 h-14 rounded-full shadow-[0_8px_20px_rgba(59,130,246,0.3)] text-white transition-all duration-300 active:scale-90 ${activeTab === 'scan' ? 'bg-blue-600' : 'bg-blue-500'}`}
          >
            <ScanLine size={26} strokeWidth={2.5} />
          </button>
        </div>

        <button 
          onClick={() => onChange('profile')}
          className={`flex flex-col items-center p-2 transition-all duration-300 ${activeTab === 'profile' ? 'text-blue-500 scale-105' : 'text-tgHint'}`}
        >
          <User size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span className={`text-[10px] mt-1.5 ${activeTab === 'profile' ? 'font-bold' : 'font-medium'}`}>Profil</span>
        </button>
      </div>
    </div>
  );
}
