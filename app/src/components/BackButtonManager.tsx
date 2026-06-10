'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

/**
 * Global component that handles back button navigation rules for both
 * Web browsers (via popstate history interception) and Capacitor Mobile
 * (via native hardware backButton listeners).
 */
export default function BackButtonManager() {
  const router = useRouter();
  const pathname = usePathname();
  const lastPathnameRef = useRef(pathname);

  // Keep the pathname reference updated for async event listeners
  useEffect(() => {
    lastPathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

    /**
     * Custom hierarchical back navigation rules.
     * Returns true if handled, false otherwise.
     */
    const handleBackNavigation = (currentPath: string): boolean => {
      if (currentPath === '/play') {
        router.replace('/levels');
        return true;
      }
      if (
        currentPath === '/levels' ||
        currentPath === '/profile' ||
        currentPath === '/editor' ||
        currentPath === '/friends' ||
        currentPath === '/controls' ||
        currentPath === '/admin'
      ) {
        router.replace('/');
        return true;
      }
      if (currentPath.startsWith('/admin/')) {
        router.replace('/admin');
        return true;
      }
      return false;
    };

    // --- 1. Capacitor Native Mobile Platform ---
    if (isNative) {
      let active = true;
      let appListener: any = null;

      const setupCapacitor = async () => {
        try {
          const { App } = await import('@capacitor/app');
          if (!active) return;

          appListener = await App.addListener('backButton', async () => {
            const currentPath = lastPathnameRef.current;
            const handled = handleBackNavigation(currentPath);
            
            if (!handled) {
              if (currentPath === '/') {
                // Exit app if we are on the homepage
                await App.exitApp();
              } else {
                // Default back logic: try browser history, otherwise go home
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.replace('/');
                }
              }
            }
          });
        } catch (err) {
          console.warn('[BackButtonManager] Capacitor App listener error:', err);
        }
      };

      setupCapacitor();

      return () => {
        active = false;
        if (appListener) {
          appListener.remove();
        }
      };
    }

    // --- 2. Web Browser Platform ---
    const currentPath = pathname;
    const shouldIntercept =
      currentPath === '/play' ||
      currentPath === '/levels' ||
      currentPath === '/profile' ||
      currentPath === '/editor' ||
      currentPath === '/friends' ||
      currentPath === '/controls' ||
      currentPath === '/admin' ||
      currentPath.startsWith('/admin/');

    if (!shouldIntercept) return;

    // Push a dummy state to browser history.
    // When the user clicks the browser back button, the browser pops this state,
    // firing the popstate event but leaving the page URL unchanged, allowing us to redirect.
    window.history.pushState({ intercepted: true }, '');

    const handlePopState = (event: PopStateEvent) => {
      // Execute custom routing
      handleBackNavigation(currentPath);
      
      // Re-push dummy state for subsequent back clicks
      window.history.pushState({ intercepted: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [pathname, router]);

  return null;
}
