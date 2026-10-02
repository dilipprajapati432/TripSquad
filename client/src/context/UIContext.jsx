import { createContext, useCallback, useContext, useRef, useState } from "react";
import { X } from "lucide-react";
import Modal from "../components/Modal.jsx";
import { ACTIVITY_ICONS, TOAST_ICONS } from "../lib/icons.jsx";

// App-wide toasts ("Riya added Baga Beach") and confirm dialogs (instead of browser confirm()).

const UIContext = createContext(null);
let nextId = 1;

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (text, { icon, type = "info", duration = 4000 } = {}) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-3), { id, text, icon, type }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  /** await confirm({ title, message, confirmText, danger }) -> true / false */
  const confirm = useCallback((options) => {
    setDialog(typeof options === "string" ? { message: options } : options);
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setDialog(null);
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {
          // `icon` is an activity key ("expense", "join"...) or an icon component; otherwise use the type's icon
          const Icon = (typeof t.icon === "string" ? ACTIVITY_ICONS[t.icon] : t.icon) || TOAST_ICONS[t.type] || TOAST_ICONS.info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`} role="status">
              <span className="toast-icon"><Icon size={16} strokeWidth={2} /></span>
              <span className="toast-body">{t.text}</span>
              <button className="icon-btn icon-btn-sm" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
            </div>
          );
        })}
      </div>
      {dialog && (
        <Modal title={dialog.title || "Are you sure?"} onClose={() => close(false)}>
          <p>{dialog.message}</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={() => close(false)} autoFocus>{dialog.cancelText || "Cancel"}</button>
            <button className={`btn ${dialog.danger ? "btn-danger-solid" : "btn-primary"}`} onClick={() => close(true)}>
              {dialog.confirmText || "Confirm"}
            </button>
          </div>
        </Modal>
      )}
    </UIContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUI = () => useContext(UIContext);
