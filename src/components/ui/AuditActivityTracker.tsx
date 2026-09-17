import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useLocation } from 'react-router-dom';

const record = async (token: string, payload: Record<string, unknown>) => {
  try {
    await fetch('/.netlify/functions/audit-log', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.debug('Audit event could not be recorded:', error);
  }
};

const safeTargetText = (target: Element | null) => {
  if (!target) return '';
  const element = target.closest('button,a,[role="button"],input[type="submit"],input[type="button"]') as HTMLElement | null;
  return String(element?.getAttribute('aria-label') || element?.getAttribute('title') || element?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 180);
};

const AuditActivityTracker = () => {
  const location = useLocation();
  const tokenRef = useRef('');
  const previousUserRef = useRef<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        tokenRef.current = '';
        return;
      }
      previousUserRef.current = user.uid;
      try {
        tokenRef.current = await user.getIdToken();
        await record(tokenRef.current, {
          type: 'login_session',
          action: 'LOGIN_SESSION_ACTIVE',
          message: 'Authenticated portal session active.',
          route: window.location.pathname,
          details: { sessionStartedAt: new Date().toISOString() }
        });
      } catch (error) {
        console.debug('Audit session bootstrap failed:', error);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const token = tokenRef.current;
    if (!token) return;
    void record(token, {
      type: 'page_view',
      action: 'PAGE_VIEW',
      message: `Viewed ${location.pathname}`,
      route: `${location.pathname}${location.search}`,
      details: { pathname: location.pathname, search: location.search }
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const token = tokenRef.current;
      if (!token) return;
      const target = event.target as Element | null;
      const element = target?.closest('button,a,[role="button"],input[type="submit"],input[type="button"]') as HTMLElement | null;
      if (!element) return;
      const label = safeTargetText(target);
      if (!label && !element.dataset.audit) return;
      void record(token, {
        type: 'ui_action',
        action: element.dataset.audit || 'UI_INTERACTION',
        message: label || 'User interaction',
        route: window.location.pathname,
        details: {
          target: element.tagName.toLowerCase(),
          label,
          href: element instanceof HTMLAnchorElement ? element.getAttribute('href') || '' : '',
          id: element.id || ''
        }
      });
    };

    const handleSubmit = (event: SubmitEvent) => {
      const token = tokenRef.current;
      if (!token) return;
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      void record(token, {
        type: 'form_submit',
        action: 'FORM_SUBMITTED',
        message: `Submitted ${form.getAttribute('aria-label') || form.getAttribute('name') || 'form'}`,
        route: window.location.pathname,
        details: { form: form.getAttribute('name') || form.id || form.getAttribute('aria-label') || 'anonymous_form' }
      });
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, []);

  return null;
};

export default AuditActivityTracker;
