import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Certifique-se de que este caminho está correto
import { API_ENDPOINTS } from '../config/api';

// Importações do Chart.js
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Registra os componentes necessários do Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

function DashboardPage() {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    // ALTERADO: `devices` agora guardará os dispositivos do Tasmota (reais ou fictícios)
    const [devices, setDevices] = useState([]);

    // Estados para as métricas exibidas
    const [currentMonthConsumption, setCurrentMonthConsumption] = useState('0.00 kWh');
    const [dailyConsumption, setDailyConsumption] = useState('0.00 kWh');
    const [totalConsumption, setTotalConsumption] = useState('0.00 kWh');

    // Estado para controlar a seção ativa na sidebar
    const [activeSection, setActiveSection] = useState('inicio');

    // Estado para mensagens de feedback dos dispositivos
    const [deviceMessage, setDeviceMessage] = useState('');

    // NOVO: Estado para controlar o modo de visualização do gráfico (day, week, month)
    const [viewMode, setViewMode] = useState('day');

    // NOVO: Estado para indicar se os dados exibidos são reais ou fictícios
    const [isRealData, setIsRealData] = useState(false);
    // NOVO: Estado para a mensagem de dados fictícios
    const [fictionalDataMessage, setFictionalDataMessage] = useState('');

    // Cache para evitar logs repetitivos no frontend
    const [lastLoggedData, setLastLoggedData] = useState(null);
    const [lastLogTime, setLastLogTime] = useState(0);

    // Dados fictícios para os modos de visualização do gráfico principal.
    // Estes serão usados quando isRealData for false.
    const mockDailyData = {
        labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
        datasets: [{
            label: 'Consumo Diário (kWh)',
            data: [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9],
            borderColor: '#00bcd4',
            backgroundColor: 'rgba(0, 188, 212, 0.4)',
            tension: 0.4,
            fill: true,
        }],
    };

    const mockWeeklyData = {
        labels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
        datasets: [{
            label: 'Consumo Semanal (kWh)',
            data: [22.5, 24.1, 21.8, 25.3],
            borderColor: '#ff9800',
            backgroundColor: 'rgba(255, 152, 0, 0.4)',
            tension: 0.4,
            fill: true,
        }],
    };

    const mockMonthlyData = {
        labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
        datasets: [{
            label: 'Consumo Mensal (kWh)',
            data: [90.2, 95.8, 88.5, 102.1, 99.7, 105.3, 98.0, 101.5, 93.0, 100.1, 97.5, 108.0],
            borderColor: '#e91e63',
            backgroundColor: 'rgba(233, 30, 99, 0.4)',
            tension: 0.4,
            fill: true,
        }],
    };

    // NOVO: Estado para armazenar o valor em tempo real do consumo total
    const [liveTotalEnergy, setLiveTotalEnergy] = useState(null);

    // Estados para modais de edição/exclusão de conta
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editName, setEditName] = useState(userName);
    const [editPassword, setEditPassword] = useState('');
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // [1] Adicionar estado para menu mobile
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // [2] Função para detectar largura da tela
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > 700 && isMobileMenuOpen) setIsMobileMenuOpen(false);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobileMenuOpen]);

    // ALTERADO: Esta função agora deve processar os `devices` (que podem ser reais do Tasmota ou os mocks)
    const getConsumptionByTypeData = () => {
        const deviceTypeConsumption = {};
        devices.forEach(device => {
            const type = device.model || 'Dispositivo de Energia';
            const consumption = device.latestReading ? device.latestReading.totalEnergy : (device.latestReading ? device.latestReading.power : 0);
            if (deviceTypeConsumption[type]) {
                deviceTypeConsumption[type] += consumption;
            } else {
                deviceTypeConsumption[type] = consumption;
            }
        });
        const labels = Object.keys(deviceTypeConsumption);
        const data = Object.values(deviceTypeConsumption);
        // Se só houver um dispositivo, use apenas azul
        const singleColor = ['#00bcd4'];
        const singleBorder = ['#00838f'];
        const backgroundColors = labels.length === 1 ? singleColor : ['#00bcd4', '#ff9800', '#e91e63', '#4caf50', '#9c27b0', '#f44336', '#2196f3', '#ffeb3b'];
        const borderColors = labels.length === 1 ? singleBorder : ['#00838f', '#f57c00', '#c2185b', '#388e3c', '#7b1fa2', '#d32f2f', '#1976d2', '#fbc02d'];
        return {
            labels: labels.length > 0 ? labels : ['Nenhum dado'],
            datasets: [{
                data: data.length > 0 ? data : [1],
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
            }],
        };
    };

    // ALTERADO: Adapte esta função para basear as sugestões nos dispositivos reais/fictícios.
    const getSuggestedDevicesData = () => {
        // Se estiver em modo de dados fictícios, pode retornar sugestões mais genéricas.
        // Se estiver em modo real, você pode analisar os dados reais dos dispositivos para gerar sugestões.
        if (!isRealData) {
            return [{
                    id: 1,
                    name: 'Lâmpada do Quarto (Fictícia)',
                    suggestion: 'Instalar temporizador para desligar automaticamente.'
                },
                {
                    id: 2,
                    name: 'Ar Condicionado (Fictício)',
                    suggestion: 'Configurar automação para ajustar temperatura ao sair.'
                },
                {
                    id: 3,
                    name: 'Geladeira (Fictícia)',
                    suggestion: 'Verificar vedação da porta para evitar perda de energia.'
                },
                {
                    id: 4,
                    name: 'TV da Sala (Fictícia)',
                    suggestion: 'Ativar modo de economia de energia nas configurações.'
                },
            ];
        }

        // Lógica para dados reais (simplificada por enquanto)
        // Aqui você pode iterar sobre `devices` e suas `latestReading` para dar sugestões
        // Por exemplo, se um dispositivo está ligado há muito tempo com alto consumo.
        const suggestions = [];
        devices.forEach(device => {
            if (device.powerState && device.latestReading && device.latestReading.power > 100) { // Exemplo: ligado e com consumo alto
                suggestions.push({
                    id: device.id,
                    name: device.name,
                    suggestion: `Dispositivo ligado com alto consumo (${device.latestReading.power}W). Considere automação ou desligamento quando não estiver em uso.`,
                });
            } else if (!device.powerState) {
                suggestions.push({
                    id: device.id,
                    name: device.name,
                    suggestion: `Dispositivo ${device.name} está desligado. Ótima gestão de energia!`,
                });
            } else {
                suggestions.push({
                    id: device.id,
                    name: device.name,
                    suggestion: `Consumo de ${device.name} está normal. Pequenos ajustes podem otimizar mais.`,
                });
            }
        });
        return suggestions;
    };

    // ALTERADO: `getChartData` agora usará dados reais quando `isRealData` for true.
    // Por enquanto, `daily_consumption_kwh` é mockado no backend para ambos, então esta parte não muda muito.
    // Mas no futuro, esta função precisaria buscar dados históricos REAIS.
    const getChartData = () => {
        // Se você tiver dados históricos reais do Tasmota no futuro, eles viriam de um estado aqui.
        // Por enquanto, o backend retorna mocks para `daily_consumption_kwh` para ambos os casos.
        // Se você quiser que o admin veja gráficos reais também, o backend precisaria fornecer esses dados.
        switch (viewMode) {
            case 'day':
                // Se o backend enviar dados diários reais para o admin, use-os aqui
                return mockDailyData; // Por enquanto, ainda usa mock
            case 'week':
                return mockWeeklyData; // Por enquanto, ainda usa mock
            case 'month':
                return mockMonthlyData; // Por enquanto, ainda usa mock
            default:
                return mockDailyData;
        }
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: `Consumo de Energia - ${viewMode === 'day' ? 'Diário' : viewMode === 'week' ? 'Semanal' : 'Mensal'}`,
                color: '#FFF',
                font: { size: 18 }
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleColor: '#FFF',
                bodyColor: '#FFF',
                borderColor: '#FFF',
                borderWidth: 1,
            }
        },
        scales: {
            x: { ticks: { color: '#BBB' }, grid: { color: 'rgba(255,255,255,0.1)', borderColor: '#444' } },
            y: {
                ticks: {
                    color: '#BBB',
                    callback: function(value) {
                        return Number(value).toFixed(2) + ' kWh';
                    }
                },
                grid: { color: 'rgba(255,255,255,0.1)', borderColor: '#444' }
            },
        }
    };

    const consumptionByTypeOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#FFF' }
            },
            title: {
                display: true,
                text: 'Consumo por Tipo de Dispositivo',
                color: '#FFF',
                font: { size: 18 }
            },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleColor: '#FFF',
                bodyColor: '#FFF',
                borderColor: '#FFF',
                borderWidth: 1,
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed !== null) {
                            label += context.parsed.toFixed(2) + ' kWh';
                        }
                        return label;
                    }
                }
            }
        },
    };

    // NOVO: Função para alternar o status do dispositivo Tasmota via backend
    const toggleDevicePower = useCallback(async(deviceId, currentPowerState, deviceName) => {
        const token = localStorage.getItem('token');
        if (!token) {
            setDeviceMessage('Você não está logado.');
            return;
        }

        const newState = currentPowerState ? 'OFF' : 'ON'; // Inverte o estado
        setDeviceMessage(`Enviando comando para ${deviceName}: ${newState}...`);

        try {
            const response = await fetch(`${API_ENDPOINTS.TASMOTA}/devices/${deviceId}/power`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ state: newState })
            });

            const data = await response.json();

            if (response.ok) {
                setDeviceMessage(data.message);
                // O estado do dispositivo será atualizado no frontend quando o backend receber
                // a mensagem MQTT de confirmação do Tasmota e salvar no DB,
                // e o fetchDashboardData for chamado novamente (ou um mecanismo de atualização em tempo real).
                // Para simplificar, vou re-chamar o fetchDashboardData após um breve delay.
                setTimeout(() => {
                    fetchDashboardData(); // Re-fetch para atualizar o estado dos dispositivos
                }, 2000); // Aumentado para 2 segundos para garantir atualização
            } else {
                setDeviceMessage(data.message || 'Erro ao alternar o dispositivo.');
            }
        } catch (error) {
            setDeviceMessage('Erro de rede ao tentar controlar o dispositivo.');
            console.error('Erro ao controlar dispositivo:', error);
        } finally {
            setTimeout(() => setDeviceMessage(''), 5000); // Limpa a mensagem após 5 segundos
        }
    }, []);

    // ALTERADO: `toggleDeviceStatus` para dispositivos mockados
    const toggleDeviceStatus = (id) => {
        setDevices(prevDevices =>
            prevDevices.map(device => {
                if (device.id === id && !isRealData) { // Apenas altere mocks se não for dado real
                    const newStatus = device.powerState ? 'off' : 'on'; // Assuming powerState is boolean
                    setDeviceMessage(`Dispositivo "${device.name}" ${newStatus === 'on' ? 'Ligado' : 'Desligado'} (Fictício).`);
                    setTimeout(() => setDeviceMessage(''), 3000);
                    return {...device, powerState: newStatus === 'on' };
                }
                return device;
            })
        );
    };

    // Função centralizada para buscar os dados do dashboard
    const fetchDashboardData = useCallback(async() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }

        try {
            const response = await fetch(`${API_ENDPOINTS.DASHBOARD}/data`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();

                // Cache para evitar logs repetitivos
                const currentTime = Date.now();
                const timeSinceLastLog = currentTime - lastLogTime;
                const dataChanged = JSON.stringify(data) !== lastLoggedData;

                // Só loga se passou mais de 30 segundos ou se os dados mudaram significativamente
                if (!lastLoggedData || timeSinceLastLog > 30000 || dataChanged) {
                    console.log('Dados do Dashboard (backend) recebidos:', data);
                    setLastLoggedData(JSON.stringify(data));
                    setLastLogTime(currentTime);
                }

                // NOVO: Define se os dados são reais ou fictícios
                setIsRealData(data.isRealData);
                if (!data.isRealData) {
                    setFictionalDataMessage('Os dados exibidos são fictícios porque sua conta não possui permissões de administrador. Entre em contato com o suporte para solicitar acesso como administrador e visualizar os dados reais.');
                } else {
                    setFictionalDataMessage('');
                }

                // ATUALIZADO: `setDevices` agora usa `data.userDevices`
                setDevices(data.userDevices || []);

                const chartDataArray = data.mainChartData && data.mainChartData.datasets && data.mainChartData.datasets[0] ?
                    data.mainChartData.datasets[0].data : [];
                const totalConsumptionKwh = chartDataArray.reduce((sum, val) => sum + val, 0);
                setCurrentMonthConsumption(`${totalConsumptionKwh.toFixed(2)} kWh`);
                setTotalConsumption(`${totalConsumptionKwh.toFixed(2)} kWh`);
                if (chartDataArray.length > 0) {
                    setDailyConsumption(`${chartDataArray[chartDataArray.length - 1].toFixed(2)} kWh`);
                } else {
                    setDailyConsumption('0.00 kWh');
                }

            } else if (response.status === 401 || response.status === 403) {
                alert('Sua sessão expirou ou é inválida. Por favor, faça login novamente.');
                localStorage.removeItem('token');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                navigate('/');
            } else {
                console.error('Erro ao carregar dados do Dashboard:', response.status);
            }
        } catch (error) {
            console.error('Erro de rede ao buscar dados do dashboard:', error);
        }
    }, [navigate]); // 'fetchDashboardData' agora depende apenas de 'navigate'"

    // Atualizar função para buscar Energia Total diretamente do endpoint live para admin
    const fetchLiveTotalEnergy = useCallback(async(deviceId) => {
        if (!deviceId) return;
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(`${API_ENDPOINTS.TASMOTA}/devices/${deviceId}/total-energy-live`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setLiveTotalEnergy(data.totalEnergy);
            } else {
                setLiveTotalEnergy(0);
            }
        } catch (err) {
            setLiveTotalEnergy(0);
        }
    }, []);

    // Buscar o valor em tempo real sempre que o device principal mudar
    useEffect(() => {
        let intervalId;
        if (devices.length > 0 && devices[0].id) {
            // Atualiza imediatamente ao montar
            fetchLiveTotalEnergy(devices[0].id);
            // Atualiza a cada 10 segundos (aumentado de 5 para 10)
            intervalId = setInterval(() => {
                fetchLiveTotalEnergy(devices[0].id);
            }, 10000);
        }
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [devices, fetchLiveTotalEnergy]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUserName = localStorage.getItem('userName');
        const storedUserEmail = localStorage.getItem('userEmail');

        if (!token) {
            navigate('/');
            return;
        }

        setUserName(storedUserName ? storedUserName.split('@')[0] : '');
        setUserEmail(storedUserEmail || '');

        fetchDashboardData(); // Chama a função para buscar os dados

        // Atualização automática a cada 10 segundos (aumentado de 5 para 10)
        const interval = setInterval(() => {
            fetchDashboardData();
        }, 10000);

        // Limpa o intervalo ao sair do componente
        return () => clearInterval(interval);
    }, [navigate, fetchDashboardData]); // Dependência adicionada 'fetchDashboardData'

    // Função para logout (usada em vários lugares)
    const handleLogout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        navigate('/'); // Redireciona para a HomePage
    }, [navigate]);

    // Logout automático após 10 minutos
    useEffect(() => {
        const logoutTimer = setTimeout(() => {
            alert('Por segurança, você foi desconectado após 10 minutos de sessão. Faça login novamente.');
            handleLogout();
        }, 600000); // 10 minutos
        return () => clearTimeout(logoutTimer);
    }, [handleLogout]);

    // FUNÇÃO PARA GERAR O RELATÓRIO
    // ALTERADO: Adapte esta função para considerar `isRealData` e os dados reais.
    const generateReport = useCallback(() => {
        let totalSavings = 0;
        let totalOverspend = 0;
        let smartUsageCount = 0;
        let nonSmartUsageCount = 0;

        const devicesToReport = devices; // Usa os devices do estado, que já serão reais ou fictícios.

        const reportDetails = devicesToReport.map(device => {
            // Se for dados reais, use latestReading.power. Se fictício, use um valor padrão.
            const currentConsumptionPower = device.latestReading ? device.latestReading.power : 0.1; // Watts
            const currentConsumptionKwh = device.latestReading ? device.latestReading.totalEnergy : 0.1; // kWh acumulado
            let recommendation = "";
            let potentialImpactKwh = 0; // Impacto em kWh

            // Lógica de recomendação: pode ser mais sofisticada com base em AI no futuro.
            // Por enquanto, exemplos baseados no estado/consumo.
            if (isRealData) {
                if (device.powerState && currentConsumptionPower > 100) { // Dispositivo ligado e com alto consumo (ex: 100W)
                    recommendation = "Alto consumo atual. Considere automação para desligamento quando ocioso.";
                    potentialImpactKwh = -(currentConsumptionKwh * 0.1); // Ex: 10% de potencial overspend
                    nonSmartUsageCount++;
                } else if (!device.powerState) {
                    recommendation = "Dispositivo desligado. Ótima gestão de energia!";
                    potentialImpactKwh = currentConsumptionKwh * 0.05; // Ex: Pequena economia por estar desligado
                    smartUsageCount++;
                } else {
                    recommendation = "Uso normal. Verifique configurações para otimização contínua.";
                    potentialImpactKwh = 0;
                }
            } else { // Dados Fictícios
                if (device.powerState && Math.random() > 0.7) {
                    recommendation = "Sugerimos uso de temporizadores ou automação para desligar automaticamente.";
                    potentialImpactKwh = -(currentConsumptionKwh * 0.5);
                    nonSmartUsageCount++;
                } else if (!device.powerState && Math.random() > 0.3) {
                    recommendation = "Dispositivo desligado. Ótima gestão de energia!";
                    potentialImpactKwh = currentConsumptionKwh * 0.2;
                    smartUsageCount++;
                } else {
                    recommendation = "Uso consistente. Considere automação para otimização.";
                    potentialImpactKwh = 0;
                }
            }

            if (potentialImpactKwh < 0) {
                totalOverspend += Math.abs(potentialImpactKwh);
            } else {
                totalSavings += potentialImpactKwh;
            }

            return {
                name: device.name,
                status: device.powerState ? 'Ligado' : 'Desligado', // Use powerState
                type: device.model || 'Dispositivo', // Use model do Tasmota ou tipo genérico
                recommendation: recommendation,
                potentialImpact: potentialImpactKwh.toFixed(2)
            };
        });

        const overallImpact = totalSavings - totalOverspend;
        let overallMessage = "";
        if (overallImpact > 0) {
            overallMessage = `Com base no seu uso atual, há uma *potencial economia de energia de ${overallImpact.toFixed(2)} kWh* no próximo mês, caso adote as sugestões.`;
        } else if (overallImpact < 0) {
            overallMessage = `Seu consumo pode *aumentar em ${Math.abs(overallImpact).toFixed(2)} kWh* no próximo mês sem otimização.`;
        } else {
            overallMessage = "Seu uso de energia está estável. Pequenos ajustes podem gerar economia.";
        }

        return {
            summary: {
                totalDevices: devicesToReport.length,
                smartUsageDevices: smartUsageCount,
                nonSmartUsageDevices: nonSmartUsageCount,
                totalSavings: totalSavings.toFixed(2),
                totalOverspend: totalOverspend.toFixed(2),
                overallMessage: overallMessage
            },
            details: reportDetails
        };
    }, [devices, isRealData]); // Dependências para useCallback

    const report = generateReport(); // Usa o nome genérico 'report'

    // Função para abrir modal de edição
    const openEditModal = () => {
        setEditName(userName);
        setEditPassword('');
        setEditError('');
        setShowEditModal(true);
    };
    // Função para editar nome/senha
    const handleEditAccount = async(e) => {
        e.preventDefault();
        setEditLoading(true);
        setEditError('');
        const token = localStorage.getItem('token');
        if (!editName && !editPassword) {
            setEditError('Preencha um novo nome ou nova senha.');
            setEditLoading(false);
            return;
        }
        try {
            const response = await fetch(API_ENDPOINTS.ACCOUNT, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: editName !== userName ? editName : undefined,
                    password: editPassword || undefined
                })
            });
            const data = await response.json();
            if (response.ok) {
                alert('Dados atualizados com sucesso! Faça login novamente.');
                setShowEditModal(false);
                handleLogout();
            } else {
                setEditError(data.message || 'Erro ao atualizar dados.');
            }
        } catch (err) {
            setEditError('Erro de rede ao atualizar dados.');
        }
        setEditLoading(false);
    };
    // Função para abrir modal de exclusão
    const openDeleteModal = () => {
        setDeleteError('');
        setShowDeleteModal(true);
    };
    // Função para excluir conta
    const handleDeleteAccount = async() => {
        setDeleteLoading(true);
        setDeleteError('');
        const token = localStorage.getItem('token');
        try {
            const response = await fetch(API_ENDPOINTS.ACCOUNT, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                alert('Conta excluída com sucesso!');
                setShowDeleteModal(false);
                handleLogout();
            } else {
                setDeleteError(data.message || 'Erro ao excluir conta.');
            }
        } catch (err) {
            setDeleteError('Erro de rede ao excluir conta.');
        }
        setDeleteLoading(false);
    };

    // Adicionar este useEffect para observar mudanças no token e resetar o estado do dashboard
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/');
            return;
        }
        // Resetar estados principais ao trocar de token (login/logout)
        setDevices([]);
        setIsRealData(false);
        setFictionalDataMessage('');
        setCurrentMonthConsumption('0.00 kWh');
        setDailyConsumption('0.00 kWh');
        setTotalConsumption('0.00 kWh');
        fetchDashboardData();
    }, [localStorage.getItem('token')]);

    return ( <
        div className = "dashboard-root" > { /* Navbar fixa no topo */ } <
        nav className = "navbar" >
        <
        div className = "logo-icon-navbar" > ⚡ < /div> <
        div className = { `nav-item ${activeSection === 'inicio' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('inicio')
        } > 🏠Home < /div> <
        div className = { `nav-item ${activeSection === 'controle' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('controle')
        } > 🔌Controle de Energia < /div> <
        div className = { `nav-item ${activeSection === 'relatorios' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('relatorios')
        } > 📊Relatórios < /div> <
        div className = { `nav-item ${activeSection === 'configuracoes' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('configuracoes')
        } > ⚙️Configurações < /div> <
        button className = "nav-item logout-link-navbar"
        onClick = { handleLogout } > 🔒Sair < /button> < /
        nav > { /* Conteúdo centralizado */ } <
        main className = "main-content-centered" > {
            fictionalDataMessage && ( <
                div style = {
                    { backgroundColor: '#ffc107', color: '#333', padding: '10px 15px', borderRadius: '5px', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold' }
                } > { fictionalDataMessage } <
                /div>
            )
        } { /* Renderização condicional do conteúdo das sessões */ } {
            activeSection === 'inicio' && (
                // ...conteúdo da Home (métricas, gráficos, etc.)
            )
        } {
            activeSection === 'controle' && (
                // ...conteúdo da sessão Controle de Energia
            )
        } {
            activeSection === 'relatorios' && (
                // ...conteúdo da sessão Relatórios
            )
        } {
            activeSection === 'configuracoes' && (
                // ...conteúdo da sessão Configurações
            )
        } <
        /main> < /
        div >
    );
}

export default DashboardPage;