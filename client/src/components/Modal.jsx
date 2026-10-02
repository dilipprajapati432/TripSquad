import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Open modals, newest last. Only the top one reacts to Escape, so closing a confirm
// dialog doesn't also close (and lose) the form underneath it.
const stack = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ title, onClose, children, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const me = {};
    stack.push(me);
    const opener = document.activeElement;
    // Focus the first field (unless something inside already has autoFocus)
    if (!ref.current.contains(document.activeElement)) ref.current.querySelector(FOCUSABLE)?.focus();

    const onKey = (e) => {
      if (stack.at(-1) !== me) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
      // Keep Tab inside the dialog
      if (e.key === "Tab") {
        const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      stack.splice(stack.indexOf(me), 1);
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus(); // back to the button that opened it
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`modal card ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
