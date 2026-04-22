import { useEffect, useRef, useCallback } from 'react';

interface PaystackPop {
  resumeTransaction(accessCode: string): { close: () => void };
}

declare global {
  interface Window {
    PaystackPop?: { new (): PaystackPop };
  }
}

let scriptLoaded = false;
let scriptPromise: Promise<void> | null = null;

function loadPaystackScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById('paystack-script')) {
      scriptLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'paystack-script';
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });

  return scriptPromise;
}

export function usePaystack() {
  const popupRef = useRef<{ close: () => void } | null>(null);

  useEffect(() => {
    loadPaystackScript();
    return () => {
      popupRef.current?.close();
    };
  }, []);

  const openCheckout = useCallback(async (accessCode: string): Promise<void> => {
    await loadPaystackScript();
    if (!window.PaystackPop) {
      throw new Error('Paystack script failed to load');
    }
    const popup = new window.PaystackPop();
    popupRef.current = popup.resumeTransaction(accessCode);
  }, []);

  const closeCheckout = useCallback(() => {
    popupRef.current?.close();
    popupRef.current = null;
  }, []);

  return { openCheckout, closeCheckout };
}
