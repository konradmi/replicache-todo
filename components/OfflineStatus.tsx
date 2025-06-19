"use client";

import { useEffect, useState } from "react";

export default function OfflineStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [showOnline, setShowOnline] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setShowOnline(true);
      setTimeout(() => setShowOnline(false), 3000);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed top-6 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 justify-center">
      {isOffline && (
        <div className="flex items-center gap-2 rounded-lg bg-red-600/95 px-4 py-2 text-white shadow-lg animate-fade-in-out">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          You are offline. Changes will sync when you are back online.
        </div>
      )}
      {!isOffline && showOnline && (
        <div className="flex items-center gap-2 rounded-lg bg-green-600/95 px-4 py-2 text-white shadow-lg animate-fade-in-out">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          You are back online!
        </div>
      )}
      <style jsx global>{`
        @keyframes fade-in-out {
          0% { opacity: 0; transform: translateY(-16px); }
          10% { opacity: 1; transform: translateY(0); }
          90% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-16px); }
        }
        .animate-fade-in-out {
          animation: fade-in-out 3s both;
        }
      `}</style>
    </div>
  );
} 
