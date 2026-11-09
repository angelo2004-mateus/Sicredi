import { useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";

export function Modal({ title, description, icon, onClose, children }) {
  const dialog = useRef(null);

  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();

    return () => {
      element.close();
      previous?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="resource-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-header">
        <span className="type-icon">
          <Icon name={icon} size={20} />
        </span>
        <div>
          <h2 id="dialog-title">{title}</h2>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Fechar formulário"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
