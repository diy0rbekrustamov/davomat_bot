import { useEffect, useRef, useState, useCallback } from 'react';
import WebApp from '../telegram';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';

interface ScannerProps {
  onScan: (token: string) => Promise<boolean> | void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [error, setError] = useState<string>('');
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  const [frozenImage, setFrozenImage] = useState<string | null>(null);
  const scanningRef = useRef<boolean>(true);
  const mountedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeoutId = useRef<any>(null);

  const videoConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 }
  };

  const capture = useCallback(() => {
    if(!mountedRef.current)return;
    if (!scanningRef.current || !webcamRef.current || !canvasRef.current) {
      if (scanningRef.current) timeoutId.current = setTimeout(capture, 300);
      return;
    }

    const video = webcamRef.current.video;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return;

      const size = 400;
      canvas.width = size;
      canvas.height = size;
      
      const minDim = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - minDim) / 2;
      const startY = (video.videoHeight - minDim) / 2;

      context.drawImage(video, startX, startY, minDim, minDim, 0, 0, size, size);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "attemptBoth",
      });

      if (code && code.data) {
        scanningRef.current = false;
        
        // Qr ushlanganda rasmni qotirib qo'yish
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) setFrozenImage(imageSrc);
        
        setScanSuccess(true);
        
        try {
          WebApp.HapticFeedback.impactOccurred('heavy');
        } catch (e) {}

        // 1.5 soniya kutib keyin onScan ga o'tkazish
        timeoutId.current=setTimeout(() => {
          Promise.resolve(onScan(code.data)).then((success) => {
            if(!mountedRef.current)return;
            if (success === false) {
              setFrozenImage(null);
              setScanSuccess(false);
              scanningRef.current = true;
              timeoutId.current = setTimeout(capture, 300);
            }
          });
        }, 1500);
        return;
      }
    }

    if (scanningRef.current) {
      timeoutId.current = setTimeout(capture, 300);
    }
  }, [onScan]);

  useEffect(() => {
    mountedRef.current = true;
    scanningRef.current = true;
    timeoutId.current = setTimeout(capture, 1000);

    return () => {
      mountedRef.current = false;
      scanningRef.current = false;
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
    };
  }, [capture]);

  return (
    <div className="app-scanner fixed inset-0 flex flex-col items-center justify-center p-6 bg-tgBg text-tgText pb-28 overflow-hidden">
      <div className="bg-tgSecondaryBg rounded-3xl p-6 w-full max-w-sm flex flex-col items-center shadow-lg relative">
        <h2 className="text-xl font-bold mb-2 text-center">QR kodni skan qiling</h2>
        <p className="text-tgHint text-sm text-center mb-6">
          Kamerani guruh QR kodiga qarating
        </p>
        
        {error ? (
          <div className="text-red-500 text-center text-sm p-4 bg-red-500/10 rounded-xl mb-4">
            {error}
          </div>
        ) : (
          <div className="w-full overflow-hidden rounded-[2rem] bg-black relative flex flex-col items-center justify-center aspect-square shadow-inner">
            {frozenImage ? (
              <img src={frozenImage} className="w-full h-full object-cover absolute inset-0 opacity-90" alt="Scanned QR" />
            ) : (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="w-full h-full object-cover absolute inset-0 opacity-80"
                onUserMediaError={(err) => {
                  console.error(err);
                  setError('Kameraga ulanib bo\'lmadi. Ruxsat berilganligiga ishonch hosil qiling.');
                }}
              />
            )}
            
            {/* O'rtadagi skaner ramkasi */}
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-3/4 relative flex items-center justify-center">
                 <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white/60 rounded-tl-xl transition-colors duration-300"></div>
                 <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white/60 rounded-tr-xl transition-colors duration-300"></div>
                 <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white/60 rounded-bl-xl transition-colors duration-300"></div>
                 <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white/60 rounded-br-xl transition-colors duration-300"></div>
                 
                 {scanSuccess ? (
                   <div className="success-checkmark bg-white/20 backdrop-blur-sm rounded-full p-2">
                     <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                       <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
                       <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                     </svg>
                   </div>
                 ) : (
                   <div className="w-full h-full opacity-0"></div>
                 )}
              </div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      
      <div className="mt-8 flex justify-center relative z-10">
        <a href="https://provveb.uz" target="_blank" rel="noopener noreferrer" className="text-tgHint text-xs font-medium hover:text-tgText transition-colors">
          by provveb.uz / samir
        </a>
      </div>

      <style>{`
        .success-checkmark {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: scale .3s ease-in-out .2s both;
        }
        .checkmark {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: block;
          stroke-width: 4;
          stroke: #4ade80;
          stroke-miterlimit: 10;
          box-shadow: inset 0px 0px 0px #4ade80;
        }
        .checkmark__circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 4;
          stroke-miterlimit: 10;
          stroke: #4ade80;
          fill: none;
          animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .checkmark__check {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards;
        }
        @keyframes stroke {
          100% { stroke-dashoffset: 0; }
        }
        @keyframes scale {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
