import React, { useEffect } from "react";
import "./CustomAlert.css";

const CustomAlert = ({
  isOpen,
  onClose,
  type = "info",
  title,
  message,
  autoClose = true,
  autoCloseTime = 4000,
}) => {
  useEffect(() => {
    if (autoClose && isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseTime);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseTime, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <i className="fas fa-check-circle"></i>;
      case "error":
        return <i className="fas fa-exclamation-circle"></i>;
      case "warning":
        return <i className="fas fa-exclamation-triangle"></i>;
      case "info":
        return <i className="fas fa-info-circle"></i>;
      default:
        return <i className="fas fa-info-circle"></i>;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case "success":
        return "Sucesso!";
      case "error":
        return "Erro!";
      case "warning":
        return "Atenção!";
      case "info":
        return "Informação";
      default:
        return "Alerta";
    }
  };

  return (
    <div className="custom-alert-overlay">
      <div className={`custom-alert custom-alert-${type}`}>
        <div className="custom-alert-header">
          <span className="custom-alert-icon">{getIcon()}</span>
          <h3 className="custom-alert-title">{getTitle()}</h3>
          <button
            className="custom-alert-close"
            onClick={onClose}
            aria-label="Fechar alerta"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="custom-alert-content">
          <p className="custom-alert-message">{message}</p>
        </div>
        <div className="custom-alert-footer">
          <button
            className="custom-alert-button custom-alert-button-primary"
            onClick={onClose}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomAlert;
