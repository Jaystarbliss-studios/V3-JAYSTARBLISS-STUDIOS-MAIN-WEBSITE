import React, { useEffect } from 'react';

export const GlassRippleListener: React.FC = () => {
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find closest glass-card or glass-card-subtle
      const card = target.closest('.glass-card, .glass-card-subtle') as HTMLElement | null;
      if (!card) return;

      // Ensure card has relative positioning for the ripple
      if (getComputedStyle(card).position === 'static') {
        card.style.position = 'relative';
      }
      if (getComputedStyle(card).overflow !== 'hidden') {
        card.style.overflow = 'hidden';
      }

      const rect = card.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const size = Math.max(rect.width, rect.height) * 1.5;

      const ripple = document.createElement('span');
      ripple.className = 'glass-ripple';
      ripple.style.left = `${clickX - size / 2}px`;
      ripple.style.top = `${clickY - size / 2}px`;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;

      card.appendChild(ripple);

      setTimeout(() => {
        if (ripple.parentNode === card) {
          card.removeChild(ripple);
        }
      }, 700);
    };

    window.addEventListener('click', handleDocumentClick, { capture: true, passive: true });
    return () => {
      window.removeEventListener('click', handleDocumentClick, { capture: true });
    };
  }, []);

  return null;
};

export default GlassRippleListener;
