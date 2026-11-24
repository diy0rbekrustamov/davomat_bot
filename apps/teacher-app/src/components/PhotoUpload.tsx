import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Loader2, Video, XCircle } from 'lucide-react';
import WebApp from '../telegram';
import Webcam from 'react-webcam';

export default function PhotoUpload({ sessionId, onComplete }: { sessionId: string, onComplete: () => void }) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const captureBusy = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(()=>{const urls=photos.map(f=>URL.createObjectURL(f));setPhotoUrls(urls);return ()=>urls.forEach(url=>URL.revokeObjectURL(url));},[photos]);

  const videoConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  };

  const capturePhoto = useCallback(async () => {
    if (captureBusy.current || photos.length >= 5) return;
    captureBusy.current = true;
    setIsCapturing(true);
    setError(null);
    try {
      const imageSrc = webcamRef.current?.getScreenshot();
      if (!imageSrc) throw new Error('Kamera hali tayyor emas. Biroz kutib yana suratga oling.');
      const blob = await (await fetch(imageSrc)).blob();
      if (blob.size > 8 * 1024 * 1024) throw new Error('Surat 8 MB dan katta. Galereyadan kichikroq rasm tanlang.');
      const file = new File([blob], 'photo_' + Date.now() + '.jpg', { type: 'image/jpeg' });
      setPhotos(previous => [...previous, file].slice(0, 5));
      if (photos.length + 1 >= 5) setCameraActive(false);
      try { WebApp.HapticFeedback.impactOccurred('heavy'); } catch { /* Optional haptics. */ }
    } catch (error: any) { setError(error.message || 'Suratni olib bo‘lmadi.'); }
    finally { captureBusy.current = false; setIsCapturing(false); }
  }, [photos.length]);

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    setPhotos(newPhotos);
    

  };

  const handleSubmit = async () => {
    if(isLoading)return;
    if(!sessionId){setError('Davomat sessiyasi topilmadi. QR kodni qayta skan qiling.');return;}
    if (photos.length === 0) {
      WebApp.showAlert('Iltimos, kamida bitta rasm yuklang!');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      photos.forEach(file => {
        formData.append('photos', file);
      });

      const uploadRes = await fetch(`/api/attendance/sessions/${sessionId}/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `tma ${WebApp.initData}`,
        },
        body: formData
      });

      if (!uploadRes.ok) throw new Error((await uploadRes.json()).message || "Rasmlarni yuklashda xatolik");

      const completeRes = await fetch(`/api/attendance/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `tma ${WebApp.initData}`,
        }
      });

      if (!completeRes.ok) throw new Error((await completeRes.json()).message || "Yakunlashda xatolik");

      onComplete();
    } catch (err: any) {
      setError(err.message || 'Xatolik yuz berdi. Iltimos qayta urinib ko\'ring.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if(newFiles.some(f=>!f.type.startsWith('image/') || f.size>5*1024*1024)){setError('Faqat 5 MB gacha bo‘lgan rasmlarni tanlang.');e.target.value='';return;}
      const combined = [...photos, ...newFiles].slice(0, 5);
      setPhotos(combined);

      setError(null);
    }
  };

  return (
    <div className="p-4 app-screen flex flex-col relative">
      <div className="mb-4">
        <h1 className="text-xl font-bold">Dars jarayonidan lavhalar</h1>
        <p className="text-sm text-tgHint">Haqiqiy holatni rasmga oling (1-5 ta)</p>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {/* Live Camera Area */}
        <div className="mb-4 rounded-xl overflow-hidden bg-black relative flex flex-col items-center justify-center min-h-[200px]">
          {cameraActive ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                screenshotQuality={0.98}
                forceScreenshotSourceSize
                videoConstraints={videoConstraints}
                className="w-full h-[400px] object-cover"
                onUserMediaError={(err) => {
                  console.error(err);
                  WebApp.showAlert("Kameraga ulanib bo'lmadi. Telegram ruxsatlari yoki qurilma xatosi. Pastdagi zaxira usuldan foydalaning.");
                  setCameraActive(false);
                }}
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                <button 
                  onClick={capturePhoto}
                  disabled={photos.length >= 5 || isCapturing || isLoading}
                  className="bg-white text-black font-bold py-2 px-6 rounded-full flex items-center shadow-lg disabled:opacity-50"
                >
                  <Camera size={20} className="mr-2" />
                  Rasmga olish
                </button>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-gray-400">
              <Video size={48} className="mx-auto mb-2 opacity-50" />
              <p className="mb-4 text-sm">To'g'ridan-to'g'ri ilova ichida rasmga olish</p>
              <button 
                onClick={() => setCameraActive(true)}
                disabled={photos.length >= 5 || isLoading}
                className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg flex items-center mx-auto disabled:opacity-50"
              >
                <Camera size={20} className="mr-2" />
                Kamerani Yoqish
              </button>
            </div>
          )}
        </div>

        {/* Fallback Area */}
        {!cameraActive && (
          <div className="mb-4 text-center">
            <p className="text-xs text-tgHint mb-2">Agar kamera ishlamasa, fayl sifatida yuklang:</p>
            <input 
              type="file" 
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              id="photo-upload-fallback"
            />
            <label 
              htmlFor="photo-upload-fallback"
              className={`inline-flex border border-tgHint bg-tgSecondaryBg rounded-lg py-2 px-4 items-center justify-center text-sm ${
                (photos.length >= 5 || isLoading) ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              Galereya yoki fayldan
            </label>
          </div>
        )}

        {/* Previews */}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {photoUrls.map((url, i) => (
              <div key={i} className="aspect-square bg-gray-300 rounded-lg overflow-hidden relative border border-gray-600/30">
                <img src={url} alt={`Rasm ${i+1}`} className="w-full h-full object-cover" />
                <button 
                  onClick={() => removePhoto(i)}
                  className="absolute top-1 right-1 bg-red-500/80 backdrop-blur text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-500 px-3 py-2 rounded text-sm text-center">
            {error}
          </div>
        )}
      </div>

      <div className="mt-auto pt-2 bg-tgBg pb-4">
        {cameraActive ? (
          <button 
            onClick={() => setCameraActive(false)}
            className="w-full bg-red-500 text-white py-3.5 rounded-xl font-bold flex items-center justify-center text-lg shadow-lg active:scale-95 transition-transform"
          >
            Kamerani Yopish
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={isLoading || isCapturing || photos.length === 0}
            className="w-full bg-tgButton text-tgButtonText py-3.5 rounded-xl font-bold flex items-center justify-center disabled:opacity-50 text-lg shadow-lg active:scale-95 transition-transform"
          >
            {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
            {isLoading ? 'Saqlanmoqda...' : 'Davomatni Yakunlash'}
          </button>
        )}
      </div>

      <div className="flex justify-center mt-4 mb-2 relative z-10">
        <a href="https://provveb.uz" target="_blank" rel="noopener noreferrer" className="text-tgHint text-xs font-medium hover:text-tgText transition-colors">
          by provveb.uz / samir
        </a>
      </div>
    </div>
  );
}
