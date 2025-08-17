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
      <div className="add-device-background">
        <div className="add-device-background-pattern"></div>
      </div>

      <div className="add-device-content">
        <div className="add-device-header">
          <div className="add-device-logo">
            <img src="/icon.png" alt="Smart Energy" />
            <h2>Smart Energy</h2>
          </div>
          <h3>Adicionar Novo Dispositivo</h3>
          <p>
            Configure um novo dispositivo Tasmota para monitoramento de energia
          </p>
        </div>

        <div className="add-device-card">
          <div className="card-header">
            <div className="card-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <h3>Configuração do Dispositivo</h3>
          </div>

          <form onSubmit={handleSubmit} className="device-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">
                  <span className="label-icon">📱</span>
                  Nome do Dispositivo
                </label>
                <input
                  type="text"
                  id="name"
                  value={deviceData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Sonoff Sala"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="tasmotaTopic">
                  <span className="label-icon">📡</span>
                  Tópico MQTT
                </label>
                <input
                  type="text"
                  id="tasmotaTopic"
                  value={deviceData.tasmotaTopic}
                  onChange={handleInputChange}
                  placeholder="Ex: tasmota_power_monitor"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="macAddress">
                  <span className="label-icon">🔗</span>
                  Endereço MAC
                  <span className="optional">(Opcional)</span>
                </label>
                <input
                  type="text"
                  id="macAddress"
                  value={deviceData.macAddress}
                  onChange={handleInputChange}
                  placeholder="Ex: 12:34:56:78:90:AB"
                />
              </div>

              <div className="form-group">
                <label htmlFor="model">
                  <span className="label-icon">🏷️</span>
                  Modelo
                  <span className="optional">(Opcional)</span>
                </label>
                <input
                  type="text"
                  id="model"
                  value={deviceData.model}
                  onChange={handleInputChange}
                  placeholder="Ex: Sonoff POWR316D"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="broker">
                <span className="label-icon">🌐</span>
                Broker MQTT
              </label>
              <select
                id="broker"
                value={deviceData.broker}
                onChange={handleInputChange}
                required
              >
                <option value="broker1">Broker 1 - Principal</option>
                <option value="broker2">Broker 2 - Secundário</option>
              </select>
            </div>

            {error && (
              <div className="error-message">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}

            <div className="button-group">
              <button
                type="submit"
                className="submit-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="loading-spinner" viewBox="0 0 24 24">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                        strokeDasharray="31.416"
                        strokeDashoffset="31.416"
                      >
                        <animate
                          attributeName="stroke-dasharray"
                          dur="2s"
                          values="0 31.416;15.708 15.708;0 31.416"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="stroke-dashoffset"
                          dur="2s"
                          values="0;-15.708;-31.416"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </svg>
                    Adicionando...
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Adicionar Dispositivo
                  </>
                )}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={handleCancel}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Cancelar
              </button>
            </div>
          </form>
        </div>

        <div className="add-device-info">
          <div className="info-card">
            <div className="info-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
            </div>
            <h4>Dicas de Configuração</h4>
            <ul>
              <li>
                Certifique-se de que o dispositivo Tasmota está conectado à rede
              </li>
              <li>O tópico MQTT deve ser único para cada dispositivo</li>
              <li>
                O endereço MAC ajuda na identificação única do dispositivo
              </li>
              <li>Após adicionar, o dispositivo aparecerá no dashboard</li>
            </ul>
          </div>
        </div>
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
