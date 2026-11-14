import { useEffect } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Custom React hook providing WAI-ARIA compliant focus trap for modal dialogs.
 * - Restores focus to trigger element on unmount / close.
 * - Traps Tab and Shift+Tab within the dialog container.
 * - Handles Escape key to trigger onClose.
 * 
 * @param {boolean} isOpen 
 * @param {React.RefObject} containerRef 
 * @param {() => void} [onClose] 
 */
export function useFocusTrap(isOpen, containerRef, onClose) {
  useEffect(() => {
    if (!isOpen || !containerRef?.current) return;

    const previouslyFocusedElement = document.activeElement;
    const container = containerRef.current;

    // Focus first focusable element or container
    const focusableElements = container.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onClose) {
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          // Tab
          if (document.activeElement === last || !container.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
        previouslyFocusedElement.focus();
      }
    };
  }, [isOpen, containerRef, onClose]);
}

export default useFocusTrap;
