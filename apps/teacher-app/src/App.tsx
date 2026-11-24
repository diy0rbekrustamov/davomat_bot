import { useState, useEffect } from 'react';
import WebApp from './telegram';
import Scanner from './components/Scanner';
import AttendanceForm from './components/AttendanceForm';
import PhotoUpload from './components/PhotoUpload';
import SuccessScreen from './components/SuccessScreen';
import BottomNavigation from './components/BottomNavigation';
import Profile from './components/Profile';
import History from './components/History';
import Groups from './components/Groups';

export const API_BASE = '/api';

export function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-App-View': 'teacher',
    'Authorization': `tma ${WebApp.initData}`,
  };
}

function App() {
  const [access, setAccess] = useState<'checking'|'allowed'|'denied'|'error'>('checking');
  const [accessMessage, setAccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'history' | 'scan' | 'profile' | 'groups'>('scan');
  

  const [step, setStep] = useState<'scan' | 'form' | 'photos' | 'success'>('scan');
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkAccess = async () => {
    try {
      const res=await fetch(`${API_BASE}/teachers/me`,{headers:getHeaders()});
      if(res.ok){setAccess('allowed');return;}
      const data=await res.json();
      setAccessMessage(data.message || 'Kirishni tekshirib bo‘lmadi.');
      if(res.status===401 || res.status===403 || res.status===404){setAccess('denied');setSessionData(null);setStep('scan');}
      else setAccess('error');
    } catch {setAccess('error');setAccessMessage('Tarmoq bilan bog‘lanib bo‘lmadi. Qayta tekshiring.');}
  };
  useEffect(()=>{
    void checkAccess();
    const visible=()=>{if(document.visibilityState==='visible')void checkAccess();};
    document.addEventListener('visibilitychange',visible);
    window.addEventListener('focus',visible);
    return ()=>{document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);};
  },[]);

  const handleScan = async (token: string) => {
    if (loading) return false;
    setLoading(true);

    try {
      const scanRes = await fetch(`${API_BASE}/attendance/scan/${token}`, {
        headers: getHeaders()
      });

      if (!scanRes.ok) {
        const err = await scanRes.json();
        throw new Error(err.message || 'QR kodni tekshirishda xatolik');
      }

      const scanData = await scanRes.json();
      setSessionData({
        group: scanData.group,
        teacher: scanData.teacher,
        students: scanData.group.students || []
      });
      setStep('form');
      setLoading(false);
      return true;

    } catch (e: any) {
      setLoading(false);
      WebApp.showAlert(e.message || 'Xatolik yuz berdi');
      return false;
    }
  };

  const handleFormNext = async (subject: string, records: { studentId: string, holat: string }[]) => {
    setLoading(true);

    const createAndRecord = async (force = false) => {
      try {
        const sessionRes = await fetch(`${API_BASE}/attendance/sessions`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            groupId: sessionData.group.id,
            teacherId: sessionData.teacher.id,
            customFanNomi: subject,
            force
          })
        });

        if (!sessionRes.ok) {
          const err = await sessionRes.json();
          throw new Error(err.message || 'Sessiya yaratishda xatolik');
        }

        const result = await sessionRes.json();

        if (result.warning) {
          const confirmed = await new Promise(resolve => WebApp.showConfirm(result.message, resolve));
          if (confirmed) {
            return await createAndRecord(true);
          } else {
            setLoading(false);
            return;
          }
        }

        const sessionId = result.id || result.session?.id;
        
        const res = await fetch(`${API_BASE}/attendance/sessions/${sessionId}/records`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({ records })
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Davomatni saqlashda xatolik');
        }
        
        setSessionData((prev: any) => ({ ...prev, id: sessionId }));
        setStep('photos');
      } catch (e: any) {
        WebApp.showAlert(e.message || 'Xatolik yuz berdi');
      }
      setLoading(false);
    };

    await createAndRecord(false);
  };

  const handlePhotosComplete = async () => {
    setStep('success');
  };

  const handleTabChange = (tab: 'history' | 'scan' | 'profile' | 'groups') => {
    setActiveTab(tab);
    if (tab === 'scan' && step === 'success') {
      setStep('scan');
      setSessionData(null);
    }
  };

  if(access!=='allowed')return <div className="app-safe-screen bg-tgBg text-tgText flex items-center justify-center p-6"><div className="text-center max-w-sm space-y-4">
    <h1 className="text-xl font-bold">{access==='checking'?'Kirish tekshirilmoqda...':access==='denied'?'O‘qituvchi kirishi cheklangan':'Bog‘lanishda xatolik'}</h1>
    {access!=='checking' && <><p className="text-tgHint">{accessMessage}</p><p className="text-tgHint text-sm">Admin huquqingiz bo‘lsa, botda /start orqali Admin Panelni oching.</p><button onClick={()=>{setAccess('checking');void checkAccess();}} className="bg-tgButton text-tgButtonText rounded-xl px-5 py-3">Qayta tekshirish</button></>}
  </div></div>;

  if (loading) {
    return (
      <div className="flex items-center justify-center app-safe-screen bg-tgBg text-tgText">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-tgButton opacity-80 mx-auto"></div>
          <p className="text-tgHint font-medium">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell app-teacher w-full mx-auto relative bg-tgBg text-tgText">
      {activeTab === 'profile' && <Profile />}
      
      {activeTab === 'history' && <History />}
      
      {activeTab === 'groups' && <Groups />}

      {activeTab === 'scan' && (
        <div className="pb-20">
          {step === 'scan' && <Scanner onScan={handleScan} />}
          {step === 'form' && sessionData && (
            <AttendanceForm 
              data={sessionData} 
              onNext={handleFormNext} 
            />
          )}
          {step === 'photos' && (
            <PhotoUpload 
              sessionId={sessionData?.id} 
              onComplete={handlePhotosComplete} 
            />
          )}
          {step === 'success' && <SuccessScreen onGoHistory={() => handleTabChange('history')} />}
        </div>
      )}

      {/* Navigatsiya paneli */}
      {(activeTab !== 'scan' || step === 'scan') && (
        <BottomNavigation activeTab={activeTab} onChange={handleTabChange} />
      )}
    </div>
  );
}

export default App;
