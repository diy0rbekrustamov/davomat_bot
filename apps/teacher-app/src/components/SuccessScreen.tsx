import WebApp from '../telegram';

export default function SuccessScreen({ onGoHistory }: { onGoHistory: () => void }) {
  return (
    <div className="app-screen flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      
      <div className="success-checkmark bg-green-500/10 rounded-full p-4 mb-6 ring-8 ring-green-500/5">
        <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
          <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none" />
          <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
        </svg>
      </div>

      <h1 className="text-2xl font-extrabold mb-3 text-center text-tgText tracking-tight animate-in slide-in-from-bottom-2">
        Muvaffaqiyatli saqlandi!
      </h1>
      <p className="text-center text-tgHint mb-10 text-[15px] max-w-[280px] animate-in slide-in-from-bottom-3">
        Davomat ma'lumotlari adminga yuborildi.
      </p>
      
      <button 
        onClick={onGoHistory}
        className="w-full max-w-xs bg-blue-500 hover:bg-blue-600 active:scale-95 text-white py-3.5 rounded-2xl font-bold shadow-[0_8px_20px_rgba(59,130,246,0.3)] transition-all animate-in slide-in-from-bottom-4"
      >
        Hisobotlarga o'tish
      </button>

      <style>{`
        .success-checkmark {
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: scale .3s ease-in-out .1s both;
        }
        .checkmark {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: block;
          stroke-width: 4;
          stroke: #22c55e;
          stroke-miterlimit: 10;
          box-shadow: inset 0px 0px 0px #22c55e;
        }
        .checkmark__circle {
          stroke-dasharray: 166;
          stroke-dashoffset: 166;
          stroke-width: 4;
          stroke-miterlimit: 10;
          stroke: #22c55e;
          fill: none;
          animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
        }
        .checkmark__check {
          transform-origin: 50% 50%;
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards;
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
