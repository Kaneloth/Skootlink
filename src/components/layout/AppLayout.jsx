import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { Bike, LayoutDashboard, Search, MessageCircle, MapPin, Wallet, Settings, ChevronRight, ChevronLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { auth, supabase } from '@/api/supabaseData';

const TAB_ORDER = ['/', '/search-vehicles', '/messages', '/tracking', '/wallet', '/settings'];

const TAB_META = {
  '/':                { label: 'Home',     icon: LayoutDashboard },
  '/search-vehicles': { label: 'Search',   icon: Search          },
  '/find-drivers':    { label: 'Search',   icon: Search          },
  '/mysearch':        { label: 'Search',   icon: Search          },
  '/messages':        { label: 'Messages', icon: MessageCircle   },
  '/tracking':        { label: 'Track',    icon: MapPin          },
  '/wallet':          { label: 'Wallet',   icon: Wallet          },
  '/settings':        { label: 'Settings', icon: Settings        },
};

// ─── Navigation progress bar (unchanged) ─────────────────────────────────────
function useNavigationProgress(pathname) { /* ... same as before ... */ }
function NavigationProgressBar({ pathname }) { /* ... same as before ... */ }

// ─── Peek strip (unchanged) ──────────────────────────────────────────────────
function PeekStrip({ direction, tab, progress }) { /* ... same as before ... */ }

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [accountType, setAccountType] = useState('driver');

  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const mainRef = useRef(null);
  const prevLocationRef = useRef(location.pathname);
  const [slideClass, setSlideClass] = useState('');
  const accountTypeRef = useRef('driver');

  useEffect(() => { accountTypeRef.current = accountType; }, [accountType]);

  useEffect(() => {
    const prevPath = prevLocationRef.current;
    const newPath = location.pathname;
    prevLocationRef.current = newPath;

    const normalize = (p) =>
      (p === '/find-drivers' || p === '/mysearch') ? '/search-vehicles' : p;

    const prevIndex = TAB_ORDER.indexOf(normalize(prevPath));
    const newIndex  = TAB_ORDER.indexOf(normalize(newPath));

    if (Math.abs(newIndex - prevIndex) >= 1 && prevIndex !== -1 && newIndex !== -1) {
      setSlideClass(newIndex > prevIndex ? 'slide-from-right' : 'slide-from-left');
      const timer = setTimeout(() => setSlideClass(''), 320);
      return () => clearTimeout(timer);
    } else {
      setSlideClass('');
    }
  }, [location.pathname]);

  useEffect(() => {
    auth.me().then(user => {
      setAccountType(user?.subscription_plan || 'driver');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
        session?.refresh_token &&
        localStorage.getItem('scootlink_signin_method') === 'biometric'
      ) {
        fetch('/.netlify/functions/auth-set-token', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: session.refresh_token }),
        }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const getSearchPath = useCallback(() => {
    const type = accountTypeRef.current;
    if (type === 'owner') return '/find-drivers';
    if (type === 'both') return '/mysearch';
    return '/search-vehicles';
  }, []);

  const getCurrentTabIndex = useCallback((pathname) => {
    const path = pathname || location.pathname;
    if (path === '/search-vehicles' || path === '/find-drivers' || path === '/mysearch') return 1;
    return TAB_ORDER.indexOf(path);
  }, [location.pathname]);

  const peekInfo = useMemo(() => {
    if (!isDragging) return null;
    const containerWidth = mainRef.current?.offsetWidth || window.innerWidth;
    const threshold = containerWidth * 0.25;
    const currentIndex = getCurrentTabIndex();
    if (currentIndex === -1) return null;
    const progress = Math.abs(dragOffset) / threshold;
    if (dragOffset < -10 && currentIndex < TAB_ORDER.length - 1) {
      const nextPath = currentIndex === 0 ? getSearchPath() : TAB_ORDER[currentIndex + 1];
      return { direction: 'right', tab: TAB_META[nextPath] || TAB_META[TAB_ORDER[currentIndex + 1]], progress };
    }
    if (dragOffset > 10 && currentIndex > 0) {
      return { direction: 'left', tab: TAB_META[TAB_ORDER[currentIndex - 1]], progress };
    }
    return null;
  }, [isDragging, dragOffset, getCurrentTabIndex, getSearchPath]);

  // ── Touch handling (fixed with touch‑action override) ───────────────────────
  useEffect(() => {
    const handleTouchStart = (e) => {
      if (!mainRef.current?.contains(e.target)) return;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      isDraggingRef.current = false;
      dragOffsetRef.current = 0;
      // Reset any previous touch‑action override
      if (mainRef.current) mainRef.current.style.touchAction = '';
    };

    const handleTouchMove = (e) => {
      const { x: startX, y: startY } = touchStartRef.current;
      if (startX === 0 && startY === 0) return;

      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (!isDraggingRef.current) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 0.8) {
          // Only after we're sure it's a horizontal swipe, lock touch‑action on main
          isDraggingRef.current = true;
          setIsDragging(true);
          if (mainRef.current) mainRef.current.style.touchAction = 'none';
          // Prevent default to stop scrolling while we drag
          e.preventDefault();
        } else if (Math.abs(dy) > 10) {
          touchStartRef.current = { x: 0, y: 0 };
          return;
        }
      }

      if (isDraggingRef.current) {
        e.preventDefault();
        dragOffsetRef.current = dx;
        setDragOffset(dx);
      }
    };

    const handleTouchEnd = () => {
      if (!isDraggingRef.current) {
        touchStartRef.current = { x: 0, y: 0 };
        return;
      }

      const containerWidth = mainRef.current?.offsetWidth || window.innerWidth;
      const threshold = containerWidth * 0.25;
      const dx = dragOffsetRef.current;
      const currentIndex = getCurrentTabIndex();

      if (currentIndex !== -1) {
        if (dx < -threshold && currentIndex < TAB_ORDER.length - 1) {
          const nextPath = currentIndex === 0 ? getSearchPath() : TAB_ORDER[currentIndex + 1];
          navigate(nextPath);
        } else if (dx > threshold && currentIndex > 0) {
          navigate(TAB_ORDER[currentIndex - 1]);
        }
      }

      // Reset touch‑action and drag state
      if (mainRef.current) mainRef.current.style.touchAction = '';
      isDraggingRef.current = false;
      dragOffsetRef.current = 0;
      touchStartRef.current = { x: 0, y: 0 };
      setIsDragging(false);
      setDragOffset(0);
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove',  handleTouchMove,  { passive: false });
    window.addEventListener('touchend',   handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove',  handleTouchMove);
      window.removeEventListener('touchend',   handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [getCurrentTabIndex, getSearchPath, navigate]);

  const inlineStyle = isDragging
    ? { transform: `translateX(${dragOffset}px)`, touchAction: 'none' }
    : {};

  return (
    <div className="flex min-h-screen bg-background">
      <style>{`
        .main-content { transition: none !important; }
        @keyframes slideFromRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0);    }
        }
        @keyframes slideFromLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0);     }
        }
        .slide-from-right { animation: slideFromRight 0.3s ease-out forwards; }
        .slide-from-left  { animation: slideFromLeft  0.3s ease-out forwards; }
      `}</style>

      <NavigationProgressBar pathname={location.pathname} />

      <Sidebar />

      <div className="relative flex-1 lg:ml-64 overflow-hidden">
        {peekInfo && (
          <PeekStrip
            direction={peekInfo.direction}
            tab={peekInfo.tab}
            progress={peekInfo.progress}
          />
        )}

        <main
          ref={mainRef}
          className={`h-screen overflow-y-auto pb-20 lg:pb-0 main-content ${slideClass}`}
          style={inlineStyle}
        >
          <div className="lg:hidden flex items-center px-4 py-3 border-b border-border bg-card sticky top-0 z-30">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Bike className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-bold text-foreground">Scootlink</span>
            </Link>
          </div>
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </div>
  );
}