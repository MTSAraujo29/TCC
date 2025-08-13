import React, { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import "./AddDevicePage.css";
import { API_ENDPOINTS } from "../config/api";
import CustomAlert from "../components/CustomAlert";
import useCustomAlert from "../hooks/useCustomAlert";

function AddDevicePage() {
  // State management
  const [deviceData, setDeviceData] = useState({
    name: "",
    tasmotaTopic: "",
    macAddress: "",
    model: "",
    broker: "broker1",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { alertState, showSuccess, showError, hideAlert } = useCustomAlert();

  // Router hooks
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Event handlers
  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setDeviceData((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const token = localStorage.getItem("token");
    if (!token) {
      handleUnauthenticated();
      return;
    }

    try {
      await addDevice(token);
    } catch (err) {
      handleDeviceError(err);
    } finally {
      setLoading(false);
    }
  };

  // API functions
  const addDevice = async (token) => {
    const response = await fetch(`${API_ENDPOINTS.TASMOTA}/devices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(deviceData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Falha ao adicionar dispositivo.");
    }

    const data = await response.json();
    handleSuccess(data);
  };

  // Helper functions
  const handleUnauthenticated = () => {
    setError("Você não está autenticado. Por favor, faça login.");
    navigate("/login");
    setLoading(false);
  };

  const handleSuccess = (data) => {
    showSuccess(
      data.message || "Dispositivo adicionado com sucesso!",
      "Dispositivo Adicionado!"
    );
    setTimeout(() => {
      navigate("/dashboard");
    }, 2000);
  };

  const handleDeviceError = (err) => {
    console.error("Erro ao adicionar dispositivo:", err);
    const errorMessage = err.message;
    setError(errorMessage);
    showError(errorMessage, "Erro ao Adicionar Dispositivo");
  };

  const handleCancel = () => {
    const from = searchParams.get("from");
    if (from === "configuracao") {
      navigate("/dashboard?tab=configuracao");
    } else if (from === "controle") {
      navigate("/dashboard?tab=controle");
    } else {
      navigate("/dashboard");
    }
  };

  // Render
  return (
    <div className="add-device-page-container">
      <div className="add-device-card">
        <h2>Adicionar Novo Dispositivo Tasmota</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Nome do Dispositivo:</label>
            <input
              type="text"
              id="name"
              value={deviceData.name}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="tasmotaTopic">Tópico Tasmota (MQTT Topic):</label>
            <input
              type="text"
              id="tasmotaTopic"
              value={deviceData.tasmotaTopic}
              onChange={handleInputChange}
              placeholder="Ex: tasmota_power_monitor"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="macAddress">Endereço MAC (Opcional):</label>
            <input
              type="text"
              id="macAddress"
              value={deviceData.macAddress}
              onChange={handleInputChange}
              placeholder="Ex: 12:34:56:78:90:AB"
            />
          </div>

          <div className="form-group">
            <label htmlFor="model">Modelo (Opcional):</label>
            <input
              type="text"
              id="model"
              value={deviceData.model}
              onChange={handleInputChange}
              placeholder="Ex: Sonoff POWR316D"
            />
          </div>

          <div className="form-group">
            <label htmlFor="broker">Broker:</label>
            <select
              id="broker"
              value={deviceData.broker}
              onChange={handleInputChange}
              required
            >
              <option value="broker1">Broker 1</option>
              <option value="broker2">Broker 2</option>
            </select>
          </div>

          {error && <p className="error-message">{error}</p>}

          <div className="button-group">
            <button type="submit" disabled={loading}>
              {loading ? "Adicionando..." : "Adicionar Dispositivo"}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={handleCancel}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>

      <CustomAlert
        isOpen={alertState.isOpen}
        onClose={hideAlert}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        autoClose={alertState.autoClose}
        autoCloseTime={alertState.autoCloseTime}
      />
    </div>
  );
}

export default AddDevicePage;
