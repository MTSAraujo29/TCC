// frontend/src/pages/AddDevicePage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AddDevicePage.css'; // Opcional: crie este arquivo CSS para estilização

function AddDevicePage() {
    const [name, setName] = useState('');
    const [tasmotaTopic, setTasmotaTopic] = useState('');
    const [macAddress, setMacAddress] = useState('');
    const [model, setModel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const API_BASE_URL = 'http://localhost:5000/api'; // Verifique se esta URL está correta

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
            setError('Você não está autenticado. Por favor, faça login.');
            navigate('/login');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/tasmota/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, tasmotaTopic, macAddress, model })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao adicionar dispositivo.');
            }

            const data = await response.json();
            alert(data.message || 'Dispositivo adicionado com sucesso!');
            navigate('/dashboard'); // Redireciona para o dashboard após adicionar
        } catch (err) {
            console.error('Erro ao adicionar dispositivo:', err);
            setError(err.message);
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
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="tasmotaTopic">Tópico Tasmota (MQTT Topic):</label>
                        <input
                            type="text"
                            id="tasmotaTopic"
                            value={tasmotaTopic}
                            onChange={(e) => setTasmotaTopic(e.target.value)}
                            placeholder="Ex: tasmota_power_monitor"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="macAddress">Endereço MAC (Opcional):</label>
                        <input
                            type="text"
                            id="macAddress"
                            value={macAddress}
                            onChange={(e) => setMacAddress(e.target.value)}
                            placeholder="Ex: 12:34:56:78:90:AB"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="model">Modelo (Opcional):</label>
                        <input
                            type="text"
                            id="model"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="Ex: Sonoff POWR316D"
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" disabled={loading}>
                        {loading ? 'Adicionando...' : 'Adicionar Dispositivo'}
                    </button>
                    <button type="button" className="cancel-button" onClick={() => navigate('/dashboard')}>
                        Cancelar
                    </button>
                </form>
            </div>
        </div>
    );
}

export default AddDevicePage;