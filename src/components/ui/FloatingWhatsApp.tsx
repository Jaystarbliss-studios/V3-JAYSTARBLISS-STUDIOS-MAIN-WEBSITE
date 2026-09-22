import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MessageCircle, X } from 'lucide-react';

export const FloatingWhatsApp: React.FC = () => {
  const location = useLocation();
  const [phoneNumber, setPhoneNumber] = useState('2349136518194');
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);

  // Hide on admin and portal full dashboards if necessary, or show everywhere
  const isPortalOrAdmin = location.pathname.startsWith('/portal/') || location.pathname.startsWith('/admin');

  useEffect(() => {
    const fetchNumber = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const raw = data.whatsappNumber || data.contactPhone || '+234 913 651 8194';
          const clean = raw.replace(/[^0-9]/g, '');
          if (clean) setPhoneNumber(clean);
        }
      } catch {
        // Fallback default
      }
    };
    fetchNumber();
  }, []);

  if (isPortalOrAdmin) return null;

  const defaultMsg = encodeURIComponent(
    'Hello Jaystarbliss Studios! I would like to make an inquiry regarding your coding programs and services.'
  );
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${defaultMsg}`;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end pointer-events-auto">
      {/* Tooltip / Greeting bubble */}
      {showTooltip && (
        <div className="mb-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xl max-w-xs text-xs animate-in fade-in slide-in-from-bottom-2 duration-300 relative">
          <button
            onClick={() => setShowTooltip(false)}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close message"
          >
            <X size={13} />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-slate-900 dark:text-white text-[11px]">Chat with Admissions</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-snug text-[11px]">
            Have questions about student enrollment or partnerships? Chat with us live!
          </p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition-colors"
          >
            <MessageCircle size={12} />
            <span>Open WhatsApp</span>
          </a>
        </div>
      )}

      {/* Floating Button */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg shadow-emerald-900/20 flex items-center justify-center transition-all hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-400/40"
      >
        <svg
          className="w-7 h-7 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.188 8.188 0 012.41 5.82c0 4.54-3.7 8.24-8.24 8.24-1.44 0-2.84-.38-4.08-1.1l-.29-.17-3.03.79.81-2.95-.19-.3a8.216 8.216 0 01-1.26-4.33c0-4.54 3.7-8.24 8.24-8.24l.02-.18zm4.51 11.59c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.25-1.5-1.4-1.75-.14-.25-.02-.39.11-.51.11-.11.25-.29.38-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.78 2.72 4.31 3.81.6.26 1.07.41 1.44.53.61.19 1.16.17 1.6.1.49-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.12-.23-.19-.48-.31z"/>
        </svg>
      </a>
    </div>
  );
};
