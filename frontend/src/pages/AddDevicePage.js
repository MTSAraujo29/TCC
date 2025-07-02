import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Router hooks
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Helper functions
    function validateTopic(topic) {
        return topic && topic.length >= 3 && !/\s/.test(topic);
    }

    // Event handlers
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setDeviceData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleUnauthenticated = () => {
        setError('Você não está autenticado. Por favor, faça login.');
        navigate('/login');
        setLoading(false);
    };

    const handleCancel = () => {
        const from = searchParams.get('from');
        if (from === 'configuracao') {
            navigate('/dashboard?tab=configuracao');
        } else if (from === 'controle') {
            navigate('/dashboard?tab=controle');
        } else {
            navigate('/dashboard');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!deviceData.name.trim()) {
            setError('O nome do dispositivo é obrigatório.');
            return;
        }

        if (!validateTopic(deviceData.tasmotaTopic)) {
            setError('O tópico Tasmota é obrigatório, deve ter pelo menos 3 caracteres e não pode conter espaços.');
            return;
        }

        if (!deviceData.model.trim()) {
            setError('O modelo do dispositivo é obrigatório.');
            return;
        }

        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                handleUnauthenticated();
                return;
            }

            const response = await fetch(`${API_ENDPOINTS.TASMOTA}/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(deviceData)
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || (data.errors && data.errors[0]?.msg) || 'Erro ao adicionar dispositivo.');
            } else {
                setSuccess('Dispositivo adicionado com sucesso!');
                setDeviceData({
                    name: '',
                    tasmotaTopic: '',
                    macAddress: '',
                    model: ''
                });
            }
        } catch (err) {
            setError('Erro de rede. Tente novamente mais tarde.');
        } finally {
            setLoading(false);
        }
    };

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
                            aria-required="true"
                            autoFocus
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
                            aria-required="true"
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
                            required
                            aria-required="true"
                        />
                    </div>

                    {error && <p className="error-message">{error}</p>}
                    {success && <p className="success-message">{success}</p>}

                    <div className="button-group">
                        <button type="submit" disabled={loading}>
                            {loading ? 'Adicionando...' : 'Adicionar Dispositivo'}
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
        </div>
    );
}

export default AddDevicePage;