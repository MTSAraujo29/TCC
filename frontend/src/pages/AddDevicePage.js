import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddDevicePage.css';
import { API_ENDPOINTS } from '../config/api';

function AddDevicePage() {
    // State management
    const [deviceData, setDeviceData] = useState({
        name: '',
        tasmotaTopic: '',
        macAddress: '',
        model: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    // Event handlers
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setDeviceData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
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
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(deviceData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Falha ao adicionar dispositivo.');
        }

        const data = await response.json();
        handleSuccess(data);
    };

    // Utility functions
    const handleUnauthenticated = () => {
        setError('Você não está autenticado. Por favor, faça login.');
        navigate('/login');
        setLoading(false);
    };

    const handleSuccess = (data) => {
        setSuccessMessage(data.message || 'Dispositivo adicionado com sucesso!');
        setTimeout(() => {
            setSuccessMessage('');
            navigate('/dashboard');
        }, 2500);
    };

    const handleDeviceError = (err) => {
        console.error('Erro ao adicionar dispositivo:', err);
        setError(err.message);
    };

    // Render
    return (
        <div className="add-device-page-container">
            {successMessage && (
                <div className="custom-toast success-toast">
                    {successMessage}
                </div>
            )}

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

                    {error && <p className="error-message">{error}</p>}

                    <div className="button-group">
                        <button
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? 'Adicionando...' : 'Adicionar Dispositivo'}
                        </button>
                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() => navigate('/dashboard')}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default AddDevicePage;

