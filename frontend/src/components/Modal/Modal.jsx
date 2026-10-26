import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, size = 'md', maxWidth, style }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = {
    sm:  'modal-sm',
    md:  'modal-md',
    lg:  'modal-lg',
    xl:  'modal-xl',
  }[size] || 'modal-md';

  const containerStyle = {
    ...(maxWidth ? { maxWidth } : {}),
    ...(style || {})
  };

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className={`modal-container ${sizeClass}`}
        style={containerStyle}
      >
        {/* Encabezado */}
        <div className="modal-header">
          <h3 className="modal-title" id="modal-title">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;

