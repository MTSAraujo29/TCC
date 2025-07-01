import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import './DeviceManagementPage.css';

const DeviceManagementPage = () => {
    const navigate = useNavigate();
    const [devices, setDevices] = useState([]);
    const [users, setUsers] = useState([]);
    const [selectedDevices, setSelectedDevices] = useState([]);
    const [selectedUser, setSelectedUser] = useState('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async() => {
        try {
            setLoading(true);

            // Carregar dispositivos do usuário atual
            const devicesResponse = await api.get('/tasmota/devices');
            setDevices(devicesResponse.data);

            // Carregar lista de usuários (apenas para admins)
            try {
                const usersResponse = await api.get('/tasmota/users');
                setUsers(usersResponse.data);
            } catch (error) {
                console.log('Usuário não é admin ou erro ao carregar usuários:', error);
                setUsers([]);
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            setMessage('Erro ao carregar dados. Verifique sua conexão.');
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    const handleDeviceSelection = (deviceId) => {
        setSelectedDevices(prev => {
            if (prev.includes(deviceId)) {
                return prev.filter(id => id !== deviceId);
            } else {
                return [...prev, deviceId];
            }
        });
    };

    const handleSelectAll = () => {
        if (selectedDevices.length === devices.length) {
            setSelectedDevices([]);
        } else {
            setSelectedDevices(devices.map(device => device.id));
        }
    };

    const handleDuplicateDevices = async() => {
        if (selectedDevices.length === 0) {
            setMessage('Selecione pelo menos um dispositivo para duplicar.');
            setMessageType('error');
            return;
        }

        if (!selectedUser) {
            setMessage('Selecione um usuário de destino.');
            setMessageType('error');
            return;
        }

        try {
            setLoading(true);
            const response = await api.post('/tasmota/devices/duplicate', {
                targetUserId: selectedUser,
                deviceIds: selectedDevices
            });

            setMessage(response.data.message);
            setMessageType('success');

            // Limpar seleções
            setSelectedDevices([]);
            setSelectedUser('');

            // Recarregar dados
            setTimeout(() => {
                loadData();
            }, 2000);

        } catch (error) {
            console.error('Erro ao duplicar dispositivos:', error);
            setMessage(error.response ? .data ? .message || 'Erro ao duplicar dispositivos.');
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    const clearMessage = () => {
        setMessage('');
        setMessageType('');
    };

    if (loading && devices.length === 0) {
        return ( <
            div className = "device-management-container" >
            <
            div className = "loading" > Carregando... < /div> < /
            div >
        );
    }

    return ( <
        div className = "device-management-container" >
        <
        div className = "header" >
        <
        h1 > Gerenciamento de Dispositivos < /h1> <
        button className = "back-button"
        onClick = {
            () => navigate('/dashboard')
        } > ←Voltar ao Dashboard <
        /button> < /
        div >

        {
            message && ( <
                div className = { `message ${messageType}` }
                onClick = { clearMessage } > { message } <
                span className = "close-message" > × < /span> < /
                div >
            )
        }

        <
        div className = "content" >
        <
        div className = "section" >
        <
        h2 > Seus Dispositivos < /h2> <
        p > Selecione os dispositivos que deseja duplicar para outro usuário: < /p>

        {
            devices.length === 0 ? ( <
                p className = "no-devices" > Você ainda não tem dispositivos cadastrados. < /p>
            ) : ( <
                >
                <
                div className = "select-all-container" >
                <
                label className = "select-all-checkbox" >
                <
                input type = "checkbox"
                checked = { selectedDevices.length === devices.length && devices.length > 0 }
                onChange = { handleSelectAll }
                />
                Selecionar Todos <
                /label> <
                span className = "selected-count" > { selectedDevices.length }
                de { devices.length }
                selecionado(s) <
                /span> < /
                div >

                <
                div className = "devices-grid" > {
                    devices.map(device => ( <
                        div key = { device.id }
                        className = { `device-card ${selectedDevices.includes(device.id) ? 'selected' : ''}` }
                        onClick = {
                            () => handleDeviceSelection(device.id)
                        } >
                        <
                        div className = "device-checkbox" >
                        <
                        input type = "checkbox"
                        checked = { selectedDevices.includes(device.id) }
                        onChange = {
                            () => handleDeviceSelection(device.id)
                        }
                        onClick = {
                            (e) => e.stopPropagation()
                        }
                        /> < /
                        div > <
                        div className = "device-info" >
                        <
                        h3 > { device.name } < /h3> <
                        p > < strong > Tópico: < /strong> {device.tasmotaTopic}</p >
                        <
                        p > < strong > Modelo: < /strong> {device.model || 'Não informado'}</p >
                        <
                        p > < strong > Broker: < /strong> {device.broker || 'Não definido'}</p >
                        <
                        p > < strong > Status: < /strong>  <
                        span className = { `status ${device.powerState ? 'online' : 'offline'}` } > { device.powerState ? 'Ligado' : 'Desligado' } <
                        /span> < /
                        p > {
                            device.latestReading && ( <
                                p > < strong > Potência atual: < /strong> {device.latestReading.power}W</p >
                            )
                        } <
                        /div> < /
                        div >
                    ))
                } <
                /div> < / >
            )
        } <
        /div>

        {
            users.length > 0 && ( <
                    div className = "section" >
                    <
                    h2 > Duplicar para Usuário < /h2> <
                    div className = "duplicate-form" >
                    <
                    div className = "form-group" >
                    <
                    label htmlFor = "user-select" > Selecione o usuário de destino: < /label> <
                    select id = "user-select"
                    value = { selectedUser }
                    onChange = {
                        (e) => setSelectedUser(e.target.value)
                    }
                    disabled = { selectedDevices.length === 0 } >
                    <
                    option value = "" > Escolha um usuário... < /option> {
                    users.map(user => ( <
                        option key = { user.id }
                        value = { user.id } > { user.name }({ user.email }) - { user._count.devices }
                        dispositivo(s) <
                        /option>
                    ))
                } <
                /select> < /
            div >

                <
                button className = "duplicate-button"
            onClick = { handleDuplicateDevices }
            disabled = { selectedDevices.length === 0 || !selectedUser || loading } > { loading ? 'Duplicando...' : `Duplicar ${selectedDevices.length} dispositivo(s)` } <
                /button> < /
            div > <
                /div>
        )
    }

    {
        users.length === 0 && selectedDevices.length > 0 && ( <
            div className = "section" >
            <
            div className = "info-box" >
            <
            h3 > Informação < /h3> <
            p > Você precisa ser administrador para duplicar dispositivos para outros usuários. < /p> <
            p > Se você é administrador, entre em contato com o suporte técnico. < /p> < /
            div > <
            /div>
        )
    } <
    /div> < /
    div >
);
};

export default DeviceManagementPage;