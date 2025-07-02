import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import './AddDevicePage.css';
import api from '../config/api';

function AddDevicePage() {
    // ---------------------------
    // Hooks e Estados
    // ---------------------------
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const [deviceData, setDeviceData] = useState({
        name: '',
        tasmotaTopic: '',
        macAddress: '',
        model: '',
        broker: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ---------------------------
    // Manipuladores de Eventos
    // ---------------------------
    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setDeviceData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const handleBrokerChange = (e) => {
        setDeviceData(prev => ({
            ...prev,
            broker: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!deviceData.broker || !deviceData.name || !deviceData.tasmotaTopic) {
            setError('Nome, Tópico Tasmota e Broker são obrigatórios.');
            setLoading(false);
            return;
        }

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

    // ---------------------------
    // Funções auxiliares e de API
    // ---------------------------
    const addDevice = async (token) => {
        const response = await api.post('/tasmota/devices', deviceData);
        handleSuccess(response.data);
    };

    const handleSuccess = (data) => {
        alert(data.message || 'Dispositivo adicionado com sucesso!');
        navigate('/dashboard');
    };

    const handleDeviceError = (err) => {
        console.error('Erro ao adicionar dispositivo:', err);
        setError(err.message);
    };

    const handleUnauthenticated = () => {
        setError('Você não está autenticado. Por favor, faça login.');
        navigate('/login');
        setLoading(false);
    };

    // ---------------------------
    // Renderização
    // ---------------------------
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
                        <label htmlFor="broker">Broker (Obrigatório):</label>
                        <select
                            id="broker"
                            value={deviceData.broker}
                            onChange={handleBrokerChange}
                            required
                        >
                            <option value="">Selecione o broker...</option>
                            <option value="broker1">Broker 1</option>
                            <option value="broker2">Broker 2</option>
                        </select>
                    </div>

                    {error && <p className="error-message">{error}</p>}

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
