import { useState, useCallback } from "react";

const useCustomAlert = () => {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
    autoClose: true,
    autoCloseTime: 4000,
  });

  const showAlert = useCallback(
    ({
      type = "info",
      title = "",
      message = "",
      autoClose = true,
      autoCloseTime = 4000,
    }) => {
      setAlertState({
        isOpen: true,
        type,
        title,
        message,
        autoClose,
        autoCloseTime,
      });
    },
    []
  );

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Métodos de conveniência
  const showSuccess = useCallback(
    (message, title = "") => {
      showAlert({ type: "success", message, title });
    },
    [showAlert]
  );

  const showError = useCallback(
    (message, title = "") => {
      showAlert({ type: "error", message, title });
    },
    [showAlert]
  );

  const showWarning = useCallback(
    (message, title = "") => {
      showAlert({ type: "warning", message, title });
    },
    [showAlert]
  );

  const showInfo = useCallback(
    (message, title = "") => {
      showAlert({ type: "info", message, title });
    },
    [showAlert]
  );

  // Para confirmações que não fecham automaticamente
  const showConfirm = useCallback(
    (message, title = "") => {
      showAlert({
        type: "info",
        message,
        title,
        autoClose: false,
      });
    },
    [showAlert]
  );

  return {
    alertState,
    showAlert,
    hideAlert,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirm,
  };
};

export default useCustomAlert;
