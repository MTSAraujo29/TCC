import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import './DeviceManagementPage.css';

// Componente para exibir mensagens
const Message = ({ message, type, onClose }) => (
    <div className={`message ${type}`} onClick={onClose}>
        {message}
        <span className="close-message">×</span>
    </div>
);

// Componente para o card de dispositivo
const DeviceCard = ({ device, selected, onSelect }) => (
    <div
        className={`device-card ${selected ? 'selected' : ''}`}
        onClick={() => onSelect(device.id)}
    >
        <div className="device-checkbox">
            <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelect(device.id)}
                onClick={(e) => e.stopPropagation()}
            />
        </div>
        <div className="device-info">
            <h3>{device.name}</h3>
            <p><strong>Tópico:</strong> {device.tasmotaTopic}</p>
            <p><strong>Modelo:</strong> {device.model || 'Não informado'}</p>
            <p><strong>Broker:</strong> {device.broker || 'Não definido'}</p>
            <p>
                <strong>Status:</strong>
                <span className={`status ${device.powerState ? 'online' : 'offline'}`}>
          {device.powerState ? 'Ligado' : 'Desligado'}
        </span>
            </p>
            {device.latestReading && (
                <p><strong>Potência atual:</strong> {device.latestReading.power}W</p>
            )}
        </div>
    </div>
);

const DeviceManagementPage = () => {
    // Hooks e estados
    const navigate = useNavigate();
    const [state, setState] = useState({
        devices: [],
        users: [],
        selectedDevices: [],
        selectedUser: '',
        loading: true,
        message: '',
        messageType: ''
    });

    // Destructuring para facilitar acesso
    const { devices, users, selectedDevices, selectedUser, loading, message, messageType } = state;

    // Carrega dados iniciais
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setState(prev => ({ ...prev, loading: true }));

            // Carregar dispositivos e usuários em paralelo
            const [devicesResponse, usersResponse] = await Promise.allSettled([
                api.get('/tasmota/devices'),
                api.get('/tasmota/users')
            ]);

            const newState = {
                loading: false,
                devices: devicesResponse.status === 'fulfilled' ? devicesResponse.value.data : [],
                users: usersResponse.status === 'fulfilled' ? usersResponse.value.data : []
            };

            setState(prev => ({ ...prev, ...newState }));
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            setState(prev => ({
                ...prev,
                loading: false,
                message: 'Erro ao carregar dados. Verifique sua conexão.',
                messageType: 'error'
            }));
        }
    };

    const handleDeviceSelection = (deviceId) => {
        setState(prev => ({
            ...prev,
            selectedDevices: prev.selectedDevices.includes(deviceId)
                ? prev.selectedDevices.filter(id => id !== deviceId)
                : [...prev.selectedDevices, deviceId]
        }));
    };

    const handleSelectAll = () => {
        setState(prev => ({
            ...prev,
            selectedDevices: prev.selectedDevices.length === prev.devices.length
                ? []
                : prev.devices.map(device => device.id)
        }));
    };

    const handleDuplicateDevices = async () => {
        // Validações
        if (selectedDevices.length === 0) {
            setState(prev => ({
                ...prev,
                message: 'Selecione pelo menos um dispositivo para duplicar.',
                messageType: 'error'
            }));
            return;
        }

        if (!selectedUser) {
            setState(prev => ({
                ...prev,
                message: 'Selecione um usuário de destino.',
                messageType: 'error'
            }));
            return;
        }

        try {
            setState(prev => ({ ...prev, loading: true }));

            const response = await api.post('/tasmota/devices/duplicate', {
                targetUserId: selectedUser,
                deviceIds: selectedDevices
            });

            setState(prev => ({
                ...prev,
                message: response.data.message,
                messageType: 'success',
                selectedDevices: [],
                selectedUser: ''
            }));

            // Recarregar dados após 2 segundos
            setTimeout(loadData, 2000);
        } catch (error) {
            console.error('Erro ao duplicar dispositivos:', error);
            setState(prev => ({
                ...prev,
                message: error.response?.data?.message || 'Erro ao duplicar dispositivos.',
                messageType: 'error',
                loading: false
            }));
        }
    };

    const clearMessage = () => {
        setState(prev => ({ ...prev, message: '', messageType: '' }));
    };

    if (loading && devices.length === 0) {
        return (
            <div className="device-management-container">
                <div className="loading">Carregando...</div>
            </div>
        );
    }

    return (
        <div className="device-management-container">
            <div className="header">
                <h1>Gerenciamento de Dispositivos</h1>
                <button className="back-button" onClick={() => navigate('/dashboard')}>
                    ← Voltar ao Dashboard
                </button>
            </div>

            {message && (
                <Message
                    message={message}
                    type={messageType}
                    onClose={clearMessage}
                />
            )}

            <div className="content">
                <div className="section">
                    <h2>Seus Dispositivos</h2>
                    <p>Selecione os dispositivos que deseja duplicar para outro usuário:</p>

                    {devices.length === 0 ? (
                        <p className="no-devices">Você ainda não tem dispositivos cadastrados.</p>
                    ) : (
                        <>
                            <div className="select-all-container">
                                <label className="select-all-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedDevices.length === devices.length && devices.length > 0}
                                        onChange={handleSelectAll}
                                    />
                                    Selecionar Todos
                                </label>
                                <span className="selected-count">
                  {selectedDevices.length} de {devices.length} selecionado(s)
                </span>
                            </div>

                            <div className="devices-grid">
                                {devices.map(device => (
                                    <DeviceCard
                                        key={device.id}
                                        device={device}
                                        selected={selectedDevices.includes(device.id)}
                                        onSelect={handleDeviceSelection}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {users.length > 0 && (
                    <div className="section">
                        <h2>Duplicar para Usuário</h2>
                        <div className="duplicate-form">
                            <div className="form-group">
                                <label htmlFor="user-select">Selecione o usuário de destino:</label>
                                <select
                                    id="user-select"
                                    value={selectedUser}
                                    onChange={(e) => setState(prev => ({ ...prev, selectedUser: e.target.value }))}
                                    disabled={selectedDevices.length === 0}
                                >
                                    <option value="">Escolha um usuário...</option>
                                    {users.map(user => (
                                        <option key={user.id} value={user.id}>
                                            {user.name} ({user.email}) - {user._count.devices} dispositivo(s)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                className="duplicate-button"
                                onClick={handleDuplicateDevices}
                                disabled={selectedDevices.length === 0 || !selectedUser || loading}
                            >
                                {loading ? 'Duplicando...' : `Duplicar ${selectedDevices.length} dispositivo(s)`}
                            </button>
                        </div>
                    </div>
                )}

                {users.length === 0 && selectedDevices.length > 0 && (
                    <div className="section">
                        <div className="info-box">
                            <h3>Informação</h3>
                            <p>
                                Você precisa ser administrador para duplicar dispositivos para outros usuários.
                            </p>
                            <p>Se você é administrador, entre em contato com o suporte técnico.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DeviceManagementPage;