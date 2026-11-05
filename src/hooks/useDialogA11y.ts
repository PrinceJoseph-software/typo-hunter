import { RefObject, useEffect, useRef } from 'react';

/** Open dialogs, innermost last. Only the top one reacts to keys. */
const stack: Array<RefObject<HTMLElement>> = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keyboard and focus behaviour for a modal dialog (WCAG 2.1.2, 2.4.3):
 *  - Escape closes it (only the topmost dialog when they are nested)
 *  - Tab / Shift+Tab stay inside it
 *  - focus moves into it on open and returns to the opener on close
 */
export function useDialogA11y(ref: RefObject<HTMLElement>, isOpen: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    stack.push(ref);

    const focusFirst = () => {
      const el = ref.current;
      if (!el) return;
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      const first = el.querySelector<HTMLElement>(FOCUSABLE);
      (first || el).focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== ref) return;
      const el = ref.current;
      if (!el) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(n => n.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      const i = stack.lastIndexOf(ref);
      if (i >= 0) stack.splice(i, 1);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isOpen, ref]);
}
