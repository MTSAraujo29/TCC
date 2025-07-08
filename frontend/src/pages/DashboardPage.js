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

    // Adicionar estado para mensagem de sessão expirada
    const [sessionExpired, setSessionExpired] = useState(false);

    // NOVO: Estado para armazenar o valor ao vivo de energia total dos dispositivos ligados
    const [liveTotalEnergySum, setLiveTotalEnergySum] = useState(0);

    // Adicione estados para armazenar o valor ao vivo de cada dispositivo
    const [liveTotalEnergyBroker1, setLiveTotalEnergyBroker1] = useState(0);
    const [liveTotalEnergyBroker2, setLiveTotalEnergyBroker2] = useState(0);

    // Função para buscar o valor ao vivo de energia total dos dispositivos ligados
    const fetchLiveTotalEnergySum = useCallback(async() => {
        const token = localStorage.getItem('token');
        const promises = devices
            .filter(d => d.powerState)
            .map(async d => {
                try {
                    const res = await fetch(API_ENDPOINTS.TASMOTA + `/devices/${d.id}/total-energy-live`, {
                        headers: { Authorization: 'Bearer ' + token }
                    });
                    const data = await res.json();
                    return typeof data.totalEnergy === 'number' ? data.totalEnergy : 0;
                } catch {
                    return 0;
                }
            });
        const values = await Promise.all(promises);
        setLiveTotalEnergySum(values.reduce((sum, val) => sum + val, 0));
    }, [devices]);

    // Atualiza sempre que a lista de dispositivos mudar
    useEffect(() => {
        fetchLiveTotalEnergySum();
    }, [devices, fetchLiveTotalEnergySum]);

    // Função para buscar o valor ao vivo de energia total de cada dispositivo individualmente
    const fetchLiveTotalEnergyIndividual = useCallback(async() => {
        const token = localStorage.getItem('token');
        // Broker1 (Sonoff Sala)
        if (devices[0] && devices[0].powerState) {
            try {
                const res = await fetch(API_ENDPOINTS.TASMOTA + `/devices/${devices[0].id}/total-energy-live`, {
                    headers: { Authorization: 'Bearer ' + token }
                });
                const data = await res.json();
                setLiveTotalEnergyBroker1(typeof data.totalEnergy === 'number' ? data.totalEnergy : 0);
            } catch {
                setLiveTotalEnergyBroker1(0);
            }
        } else {
            setLiveTotalEnergyBroker1(0);
        }
        // Broker2 (Sonoff Câmera)
        if (devices[1] && devices[1].powerState) {
            try {
                const res = await fetch(API_ENDPOINTS.TASMOTA + `/devices/${devices[1].id}/total-energy-live`, {
                    headers: { Authorization: 'Bearer ' + token }
                });
                const data = await res.json();
                setLiveTotalEnergyBroker2(typeof data.totalEnergy === 'number' ? data.totalEnergy : 0);
            } catch {
                setLiveTotalEnergyBroker2(0);
            }
        } else {
            setLiveTotalEnergyBroker2(0);
        }
    }, [devices]);

    useEffect(() => {
        fetchLiveTotalEnergyIndividual();
    }, [devices, fetchLiveTotalEnergyIndividual]);

    // ALTERADO: Esta função agora deve processar os `devices` (que podem ser reais do Tasmota ou os mocks)
    const getConsumptionByTypeData = () => {
        // Se houver dois dispositivos, Sonoff Sala e Sonoff Câmera
        if (devices.length >= 2) {
            const sala = devices[0];
            const camera = devices[1];
            const salaYesterday = sala.latestReading && typeof sala.latestReading.EnergyYesterday === 'number' ? sala.latestReading.EnergyYesterday : 0;
            const cameraYesterday = camera.latestReading && typeof camera.latestReading.EnergyYesterday === 'number' ? camera.latestReading.EnergyYesterday : 0;
            return {
                labels: ['Sala', 'Câmera'],
                datasets: [{
                    data: [salaYesterday, cameraYesterday],
                    backgroundColor: ['#00bcd4', '#ff9800'],
                    borderColor: ['#00838f', '#f57c00'],
                    borderWidth: 1,
                }],
            };
        }
        // Fallback para lógica antiga se não houver dois dispositivos
        const deviceTypeConsumption = {};
        devices.forEach(device => {
            const type = device.model || 'Dispositivo de Energia';
            const consumption = device.latestReading && typeof device.latestReading.EnergyYesterday === 'number' ? device.latestReading.EnergyYesterday : 0;
            if (deviceTypeConsumption[type]) {
                deviceTypeConsumption[type] += consumption;
            } else {
                deviceTypeConsumption[type] = consumption;
            }
        });
        const labels = Object.keys(deviceTypeConsumption);
        const data = Object.values(deviceTypeConsumption);
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
        switch (viewMode) {
            case 'day':
                return mockDailyData;
            case 'week':
                return mockWeeklyData;
            case 'month':
                return mockMonthlyData;
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
            setSessionExpired(true);
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
                    setFictionalDataMessage('Os dados exibidos são fictícios. Conta não Admin!');
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

                setWhatsappNumberSaved(data.whatsappNumber || null);

            } else if (response.status === 401 || response.status === 403) {
                setSessionExpired(true);
                localStorage.removeItem('token');
                localStorage.removeItem('token_exp');
                localStorage.removeItem('userName');
                localStorage.removeItem('userEmail');
                return;
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
            fetchLiveTotalEnergy(devices[0].id);
            intervalId = setInterval(() => {
                fetchLiveTotalEnergy(devices[0].id);
            }, 5 * 60 * 1000); // 5 minutos
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
            setSessionExpired(true);
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

    // Função utilitária para pegar energia total por broker
    function getTotalEnergyByBroker(devices, brokerLabel) {
        const device = devices.find(d => d.broker === brokerLabel);
        return device && device.latestReading && typeof device.latestReading.totalEnergy === 'number' ?
            device.latestReading.totalEnergy :
            0;
    }

    // [NOVO] Estado para modal e número do WhatsApp
    const [showWhatsappModal, setShowWhatsappModal] = useState(false);
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [whatsappError, setWhatsappError] = useState('');
    const [whatsappSuccess, setWhatsappSuccess] = useState('');

    // [NOVO] Função para validar e salvar número do WhatsApp
    const handleSaveWhatsapp = async(e) => {
        e.preventDefault();
        setWhatsappError('');
        setWhatsappSuccess('');
        // Regex: começa com 2 dígitos (país), depois 2 dígitos (DDD), depois 9 dígitos
        const regex = /^\d{2}\d{2}9\d{8}$/;
        if (!regex.test(whatsappNumber.replace(/\D/g, ''))) {
            setWhatsappError('Formato inválido. Exemplo: 5562999999999');
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(API_ENDPOINTS.DASHBOARD + '/update-whatsapp', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ whatsappNumber: whatsappNumber.replace(/\D/g, '') }),
            });
            if (!response.ok) throw new Error('Erro ao salvar número');
            setWhatsappSuccess('Número salvo com sucesso!');
            setWhatsappNumberSaved(whatsappNumber.replace(/\D/g, ''));
            setTimeout(() => setShowWhatsappModal(false), 1500);
        } catch {
            setWhatsappError('Erro ao salvar número. Tente novamente.');
        }
    };

    // [NOVO] Estado para armazenar o número de WhatsApp salvo
    const [whatsappNumberSaved, setWhatsappNumberSaved] = useState(null);

    // [NOVO] Função para desvincular número do WhatsApp
    const handleUnlinkWhatsapp = async() => {
        setWhatsappError('');
        setWhatsappSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(API_ENDPOINTS.DASHBOARD + '/update-whatsapp', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token,
                },
                body: JSON.stringify({ whatsappNumber: null }),
            });
            if (!response.ok) throw new Error('Erro ao desvincular número');
            setWhatsappNumberSaved(null);
            setWhatsappSuccess('Número desvinculado com sucesso!');
        } catch {
            setWhatsappError('Erro ao desvincular número. Tente novamente.');
        }
    };

    // [NOVO] Estado para controlar a seção EcoBot
    const [chatMessages, setChatMessages] = useState([
        { sender: 'EcoBot', text: 'Olá! Como posso ajudar você hoje?' }
    ]);
    const [chatInput, setChatInput] = useState('');

    // [NOVO] Função para enviar mensagem fictícia
    const handleSendMessage = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        setChatMessages([...chatMessages, { sender: userName, text: chatInput }]);
        setTimeout(() => {
            setChatMessages((msgs) => [
                ...msgs,
                { sender: 'EcoBot', text: 'Sou um bot fictício! Em breve responderei suas perguntas de verdade.' }
            ]);
        }, 800);
        setChatInput('');
    };

    if (sessionExpired) {
        return ( <
            div className = "modal-overlay"
            style = {
                {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }
            } >
            <
            div className = "modal-content"
            style = {
                {
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 4px 32px rgba(0,0,0,0.2)',
                    padding: 32,
                    maxWidth: 350,
                    width: '90%',
                    textAlign: 'center',
                    position: 'relative'
                }
            } >
            <
            img src = "/icon.png"
            alt = "Ícone"
            style = {
                {
                    width: 64,
                    height: 64,
                    marginBottom: 16,
                    marginTop: -48
                }
            }
            /> <
            h2 style = {
                { marginBottom: 16, color: '#222' }
            } >
            Sua sessão expirou < br / > faça login novamente!!
            <
            /h2> <
            button style = {
                {
                    marginTop: 16,
                    padding: '10px 32px',
                    background: '#00bcd4',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 18,
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }
            }
            onClick = {
                () => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('token_exp');
                    localStorage.removeItem('userName');
                    localStorage.removeItem('userEmail');
                    setSessionExpired(false);
                    navigate('/');
                }
            } >
            OK <
            /button> < /
            div > <
            /div>
        );
    }

    return ( <
        div className = "container dashboard-container" > { /* ==================== SIDEBAR ==================== */ } <
        div className = "sidebar"
        style = {
            { display: window.innerWidth <= 700 ? 'none' : 'flex' }
        } >
        <
        div className = "logo-icon-sidebar" >
        <
        img src = "/icon.png"
        alt = "Ícone"
        style = {
            { width: 32, height: 32, marginBottom: 4 }
        }
        /> < /
        div >

        <
        div className = { `menu-item ${activeSection === 'inicio' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('inicio')
        } > 🏠Home <
        /div>

        <
        div className = { `menu-item ${activeSection === 'controle' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('controle')
        } > 🔌Controle de Energia <
        /div>

        <
        div className = { `menu-item ${activeSection === 'relatorios' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('relatorios')
        } > 📊Relatórios <
        /div>

        <
        div className = { `menu-item ${activeSection === 'ecobot' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('ecobot')
        } >
        <
        img src = { process.env.PUBLIC_URL + '/ST.png' }
        alt = "EcoBot"
        style = {
            { width: 24, height: 24, marginRight: 8, verticalAlign: 'middle' }
        }
        />
        EcoBot <
        /div>

        <
        div className = { `menu-item ${activeSection === 'configuracoes' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('configuracoes')
        } > ⚙️Configurações <
        /div>

        <
        div className = "sidebar-bottom" >
        <
        button onClick = { handleLogout }
        className = "menu-item logout-link-sidebar" > 🔒Sair <
        /button> < /
        div > <
        /div>

        { /* ==================== MOBILE MENU ==================== */ } {
            window.innerWidth <= 700 && ( <
                div className = "mobile-menu-bar" >
                <
                div className = "mobile-menu-title" >
                <
                img src = "/icon.png"
                alt = "Ícone"
                className = "mobile-menu-icon" / >
                <
                h6 className = "mobile-menu-h6" > Smart energy < /h6> < /
                div > <
                button className = "hamburger-btn"
                onClick = {
                    () => setIsMobileMenuOpen(!isMobileMenuOpen)
                } >
                <
                span className = "hamburger-icon" > ☰ < /span> < /
                button > <
                /div>
            )
        }

        {
            window.innerWidth <= 700 && isMobileMenuOpen && ( <
                div className = "mobile-menu-box" >
                <
                div className = "menu-item"
                onClick = {
                    () => {
                        setActiveSection('inicio');
                        setIsMobileMenuOpen(false);
                    }
                } > 🏠Home <
                /div>

                <
                div className = "menu-item"
                onClick = {
                    () => {
                        setActiveSection('controle');
                        setIsMobileMenuOpen(false);
                    }
                } > 🔌Controle de Energia <
                /div>

                <
                div className = "menu-item"
                onClick = {
                    () => {
                        setActiveSection('relatorios');
                        setIsMobileMenuOpen(false);
                    }
                } > 📊Relatórios <
                /div>

                <
                div className = { `menu-item ${activeSection === 'ecobot' ? 'active' : ''}` }
                onClick = {
                    () => {
                        setActiveSection('ecobot');
                        setIsMobileMenuOpen(false);
                    }
                }
                style = {
                    { alignItems: 'center' }
                } >
                <
                img src = { process.env.PUBLIC_URL + '/ST.png' }
                alt = "EcoBot"
                style = {
                    { width: 20, height: 20, marginRight: 8, verticalAlign: 'middle' }
                }
                />
                EcoBot <
                /div>

                <
                div className = "menu-item"
                onClick = {
                    () => {
                        setActiveSection('configuracoes');
                        setIsMobileMenuOpen(false);
                    }
                } > ⚙️Configurações <
                /div>

                <
                div className = "menu-item logout-link-sidebar"
                onClick = {
                    () => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                    }
                } > 🔒Sair <
                /div> < /
                div >
            )
        }

        { /* ==================== MAIN CONTENT ==================== */ } <
        div className = "main-content" > { /* Data Mode Notification */ } {
            fictionalDataMessage && ( <
                div className = "data-mode-notification" > { fictionalDataMessage } < /div>
            )
        }

        { /* ========== HOME SECTION ========== */ } {
            activeSection === 'inicio' && ( <
                >
                <
                h2 > Olá, { userName }! < /h2>

                { /* Metrics Grid */ } <
                div className = "metrics-grid" >
                <
                div className = "metric-card" >
                <
                h3 > Consumo de Watts atual < /h3> <
                p > {
                    devices.length > 0 ?
                    devices
                    .reduce(
                        (sum, d) =>
                        sum +
                        (d.latestReading &&
                            d.powerState &&
                            typeof d.latestReading.power === 'number' ?
                            d.latestReading.power :
                            0),
                        0
                    )
                    .toFixed(2) + ' W' : '0.00 W'
                } <
                /p> < /
                div >

                <
                div className = "metric-card" >
                <
                h3 > Consumo de quilowatt - hora do mês atual < /h3> <
                p > { currentMonthConsumption } < /p> < /
                div >

                <
                div className = "metric-card" >
                <
                h3 > Consumo quilowatt - hora total < /h3> <
                p > { liveTotalEnergySum.toFixed(2) }
                kWh < /p> < /
                div >

                <
                div className = "metric-card" >
                <
                h3 > Fatura Estimada < /h3> <
                p >
                R$ { ' ' } {
                    (devices.length > 0 ?
                        devices.reduce(
                            (sum, d) =>
                            sum +
                            (d.latestReading &&
                                d.powerState &&
                                typeof d.latestReading.totalEnergy === 'number' ?
                                d.latestReading.totalEnergy :
                                0),
                            0
                        ) * 0.75 :
                        0
                    ).toFixed(2)
                } <
                /p> < /
                div >

                <
                div className = "metric-card" >
                <
                h3 > Consumo de Amperes atual < /h3> <
                p > {
                    devices
                    .filter(
                        (d) =>
                        d.powerState &&
                        d.latestReading &&
                        typeof d.latestReading.current === 'number'
                    )
                    .reduce((sum, d) => sum + d.latestReading.current, 0)
                    .toFixed(2)
                }
                A <
                /p> < /
                div >

                <
                div className = "metric-card" >
                <
                h3 > Gasto reduzido < /h3> <
                p > R$ 12, 50 < /p> < /
                div > <
                /div>

                { /* Main Chart Area */ } <
                div className = "chart-area-main" >
                <
                div className = "chart-card-main" >
                <
                div className = "view-mode-buttons" >
                <
                button onClick = {
                    () => setViewMode('day')
                }
                className = {
                    viewMode === 'day' ? 'active-view-button' : 'view-button'
                } >
                Dia <
                /button> <
                button onClick = {
                    () => setViewMode('week')
                }
                className = {
                    viewMode === 'week' ? 'active-view-button' : 'view-button'
                } >
                Semana <
                /button> <
                button onClick = {
                    () => setViewMode('month')
                }
                className = {
                    viewMode === 'month' ? 'active-view-button' : 'view-button'
                } >
                Mês <
                /button> < /
                div >

                {
                    getChartData().labels.length > 0 ? ( <
                        Line data = { getChartData() }
                        options = { chartOptions }
                        />
                    ) : ( <
                        p className = "chart-loading-message" >
                        Carregando dados do gráfico... <
                            /p>
                    )
                }

                <
                button className = "expand-chart-button"
                onClick = {
                    () => navigate('/grafico-cheio')
                } >
                Expandir Gráfico <
                /button> < /
                div > <
                /div>

                { /* Bottom Sections */ } <
                div className = "bottom-sections-grid" >
                <
                div className = "bottom-card consumption-by-type-card" >
                <
                h3 > Consumo por Tipo de Dispositivo < /h3> <
                div className = "chart-wrapper"
                style = {
                    { display: 'flex', alignItems: 'center', gap: 24 }
                } >
                <
                Doughnut data = { getConsumptionByTypeData() }
                options = { consumptionByTypeOptions }
                /> { / * Legenda personalizada com porcentagem * / } <
                div style = {
                    { display: 'flex', flexDirection: 'column', gap: 8 }
                } > {
                    (() => {
                        const data = getConsumptionByTypeData();
                        const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                        return data.labels.map((label, idx) => {
                            const value = data.datasets[0].data[idx];
                            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                            const color = data.datasets[0].backgroundColor[idx];
                            return ( <
                                div key = { label }
                                style = {
                                    { display: 'flex', alignItems: 'center', gap: 8 }
                                } >
                                <
                                span style = {
                                    { display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: color, marginRight: 6 }
                                } > < /span> <
                                span style = {
                                    { color: '#FFF', fontWeight: 500 }
                                } > { label } < /span> <
                                span style = {
                                    { color: '#BBB', marginLeft: 4 }
                                } > { percent } % < /span> < /
                                div >
                            );
                        });
                    })()
                } <
                /div> < /
                div > <
                /div>

                <
                div className = "bottom-card suggested-devices-card" >
                <
                h3 > Dispositivos Sugeridos < /h3> <
                p className = "suggestions-description" >
                Sugestões para otimizar o consumo de energia em seus dispositivos. <
                /p> <
                ul className = "device-suggestion-list" > {
                    getSuggestedDevicesData().length > 0 ? (
                        getSuggestedDevicesData().map((device) => ( <
                            li key = { device.id } >
                            <
                            strong > { device.name }: < /strong> {device.suggestion} < /
                            li >
                        ))
                    ) : ( <
                        p className = "no-suggestions-message" >
                        Nenhuma sugestão no momento. <
                        /p>
                    )
                } <
                /ul> < /
                div > <
                /div> < / >
            )
        }

        { /* ========== ENERGY CONTROL SECTION ========== */ } {
            activeSection === 'controle' && ( <
                div className = "energy-control-section" >
                <
                h2 > Controle de Dispositivos < /h2> {
                deviceMessage && ( <
                    p className = "device-feedback-message" > { deviceMessage } < /p>
                )
            }

            <
            h3 > Meus Dispositivos de Energia < /h3>

            {
                devices.length > 0 ? ( <
                    div className = "device-control-list" > {
                        devices.map((device) => ( <
                            div key = { device.id }
                            className = "device-control-item" >
                            <
                            span className = "device-control-name" > { device.name } < /span> <
                            button onClick = {
                                () =>
                                toggleDevicePower(device.id, device.powerState, device.name)
                            }
                            className = "device-toggle-button power-on"
                            type = "button"
                            disabled = { device.powerState } >
                            Ligar <
                            /button> <
                            button onClick = {
                                () =>
                                toggleDevicePower(device.id, device.powerState, device.name)
                            }
                            className = "device-toggle-button power-off"
                            type = "button"
                            disabled = {!device.powerState } >
                            Desligar <
                            /button> < /
                            div >
                        ))
                    } <
                    /div>
                ) : ( <
                    p className = "no-devices-message" > Nenhum dispositivo encontrado. < /p>
                )
            }

            {
                isRealData && ( <
                    button className = "add-device-btn"
                    onClick = {
                        () => navigate('/add-device')
                    } >
                    +Adicionar Novo Dispositivo Tasmota <
                    /button>
                )
            } <
            /div>
        )
    }

    { /* ========== REPORTS SECTION ========== */ } {
        activeSection === 'relatorios' && ( <
                div className = "reports-section" >
                <
                h2 > Relatórios de Consumo < /h2> <
                div className = "report-summary-card" >
                <
                h3 > Resumo Geral < /h3> <
                p >
                Total de Dispositivos: < strong > { report.summary.totalDevices } < /strong> < /
                p > <
                p >
                Com uso Inteligente(estimado): { ' ' } <
                strong > { report.summary.smartUsageDevices } < /strong> < /
                p > <
                p >
                Dispositivos com Otimização Pendente(estimado): { ' ' } <
                strong > { report.summary.nonSmartUsageDevices } < /strong> < /
                p > <
                p className = "overall-report-message" > { report.summary.overallMessage } < /p> < /
                div >

                {
                    isRealData && devices.length > 0 && devices[0].latestReading && ( <
                        div className = "energy-realtime-card" >
                        <
                        h3 > Dados em Tempo Real do Dispositivo Sonoff Sala < /h3> <
                        table className = "energy-realtime-table" >
                        <
                        tbody className = "energy-realtime-tbody" >
                        <
                        tr >
                        <
                        td > Tensão < /td> <
                        td > {
                            devices[0].powerState &&
                            typeof devices[0].latestReading.voltage === 'number' ?
                            devices[0].latestReading.voltage : 0
                        }
                        V <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Corrente < /td> <
                        td > {
                            devices[0].powerState &&
                            typeof devices[0].latestReading.current === 'number' ?
                            devices[0].latestReading.current : 0
                        }
                        A <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Potência Ativa < /td> <
                        td > {
                            devices[0].powerState &&
                            typeof devices[0].latestReading.power === 'number' ?
                            devices[0].latestReading.power : 0
                        }
                        W <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Potência Aparente < /td> <
                        td > {
                            devices[0].powerState &&
                            typeof devices[0].latestReading.ApparentPower === 'number' ?
                            devices[0].latestReading.ApparentPower : 0
                        }
                        VA <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Potência Reativa < /td> <
                        td > {
                            devices[0].powerState &&
                            typeof devices[0].latestReading.ReactivePower === 'number' ?
                            devices[0].latestReading.ReactivePower : 0
                        }
                        var <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Fator de Potência < /td> <
                        td > {
                            devices[0].powerState &&
                            typeof devices[0].latestReading.PowerFactor === 'number' ?
                            devices[0].latestReading.PowerFactor : 0
                        } <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Energia Hoje < /td> <
                        td > {
                            typeof devices[0].latestReading.EnergyToday === 'number' ?
                            devices[0].latestReading.EnergyToday : '--'
                        }
                        kWh <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Energia Ontem < /td> <
                        td > {
                            typeof devices[0].latestReading.EnergyYesterday === 'number' ?
                            devices[0].latestReading.EnergyYesterday : '--'
                        }
                        kWh <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Energia Total < /td> <
                        td > {
                            devices[0].powerState ?
                            liveTotalEnergyBroker1.toFixed(2) + ' kWh' : '0.00 kWh'
                        } <
                        /td> < /
                        tr > <
                        /tbody> < /
                        table > <
                        /div>
                    )
                }

                { /* Device 2 Real-time Data */ } {
                    isRealData && devices.length > 1 && devices[1].latestReading && ( <
                        div className = "energy-realtime-card"
                        style = {
                            { marginTop: '32px' }
                        } >
                        <
                        h3 > Dados em Tempo Real do Dispositivo Sonoff Câmera < /h3> <
                        table className = "energy-realtime-table" >
                        <
                        tbody className = "energy-realtime-tbody" >
                        <
                        tr >
                        <
                        td > Tensão < /td> <
                        td > {
                            devices[1].powerState &&
                            typeof devices[1].latestReading.voltage === 'number' ?
                            devices[1].latestReading.voltage : 0
                        }
                        V <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Corrente < /td> <
                        td > {
                            devices[1].powerState &&
                            typeof devices[1].latestReading.current === 'number' ?
                            devices[1].latestReading.current : 0
                        }
                        A <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Potência Ativa < /td> <
                        td > {
                            devices[1].powerState &&
                            typeof devices[1].latestReading.power === 'number' ?
                            devices[1].latestReading.power : 0
                        }
                        W <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Potência Aparente < /td> <
                        td > {
                            devices[1].powerState &&
                            typeof devices[1].latestReading.ApparentPower === 'number' ?
                            devices[1].latestReading.ApparentPower : 0
                        }
                        VA <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Potência Reativa < /td> <
                        td > {
                            devices[1].powerState &&
                            typeof devices[1].latestReading.ReactivePower === 'number' ?
                            devices[1].latestReading.ReactivePower : 0
                        }
                        var <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Fator de Potência < /td> <
                        td > {
                            devices[1].powerState &&
                            typeof devices[1].latestReading.PowerFactor === 'number' ?
                            devices[1].latestReading.PowerFactor : 0
                        } <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Energia Hoje < /td> <
                        td > {
                            typeof devices[1].latestReading.EnergyToday === 'number' ?
                            devices[1].latestReading.EnergyToday : '--'
                        }
                        kWh <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Energia Ontem < /td> <
                        td > {
                            typeof devices[1].latestReading.EnergyYesterday === 'number' ?
                            devices[1].latestReading.EnergyYesterday : '--'
                        }
                        kWh <
                        /td> < /
                        tr > <
                        tr >
                        <
                        td > Energia Total < /td> <
                        td > {
                            devices[1].powerState ?
                            liveTotalEnergyBroker2.toFixed(2) + ' kWh' : '0.00 kWh'
                        } <
                        /td> < /
                        tr > <
                        /tbody> < /
                        table > <
                        /div>
                    )
                }

                <
                h3 > Detalhes por Dispositivo < /h3> <
                div className = "device-report-list" > {
                    report.details.length > 0 ? (
                        report.details.map((detail, index) => ( <
                                div key = { index }
                                className = "device-report-item" >
                                <
                                h4 > { detail.name } < /h4> <
                                p >
                                Status Atual: { ' ' } <
                                span className = {
                                    devices[index] && devices[index].powerState ?
                                    'status-on-text' : 'status-off-text'
                                } > {
                                    devices[index] && devices[index].powerState ?
                                    'Ligado' : 'Desligado'
                                } <
                                /span> < /
                                p > <
                                p > Tipo: { detail.type } < /p> <
                                p > Recomendação: { detail.recommendation } < /p> {
                                parseFloat(detail.potentialImpact) !== 0.00 && ( <
                                    p className = {
                                        parseFloat(detail.potentialImpact) > 0 ?
                                        'impact-positive' : 'impact-negative'
                                    } >
                                    Impacto Potencial: { detail.potentialImpact }
                                    kWh no próximo mês <
                                    /p>
                                )
                            } <
                            /div>
                        ))
                ): ( <
                    p className = "no-reports-message" > Nenhum relatório disponível. < /p>
                )
            } <
            /div> < /
        div >
    )
}

{ /* ========== ECOBOT SECTION ========== */ } {
    activeSection === 'ecobot' && ( <
        div className = "main-content2" >
        <
        div style = {
            {
                width: '100%',
                maxWidth: 600,
                minWidth: 340,
                position: 'sticky',
                top: 0,
                background: 'transparent',
                zIndex: 2
            }
        } >
        <
        h1 style = {
            { color: 'white', marginBottom: 8 }
        } >
        Olá, eu sou EcoBot👋 <
        /h1> <
        h4 style = {
            { color: '#e0e0e0', marginBottom: 24 }
        } >
        Aqui { userName }, você pode me perguntar sobre previsões de consumo futuro de energia e receber dicas para um uso mais eficiente dos seus eletrodomésticos.Fique à vontade!
        <
        /h4> < /
        div > <
        div style = {
            {
                background: '#23234a',
                borderRadius: 12,
                padding: 24,
                maxWidth: 600,
                width: '100%',
                minWidth: 320,
                margin: '0 auto',
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                flex: 1,
                overflow: 'auto'
            }
        } >
        <
        div style = {
            { flex: 1, overflowY: 'auto', marginBottom: 16 }
        } > {
            chatMessages.map((msg, idx) => ( <
                div key = { idx }
                style = {
                    {
                        color: msg.sender === 'EcoBot' ? '#00e676' : '#fff',
                        textAlign: msg.sender === 'EcoBot' ? 'left' : 'right',
                        margin: '8px 0'
                    }
                } >
                <
                strong > { msg.sender }: < /strong> {msg.text} < /
                div >
            ))
        } <
        /div> <
        form onSubmit = { handleSendMessage }
        style = {
            { display: 'flex', gap: 8 }
        } >
        <
        input type = "text"
        value = { chatInput }
        onChange = {
            (e) => setChatInput(e.target.value)
        }
        placeholder = "Digite sua mensagem..."
        style = {
            { flex: 1, borderRadius: 8, border: 'none', padding: 10 }
        }
        /> <
        button type = "submit"
        style = {
            {
                background: '#00e676',
                color: '#222',
                border: 'none',
                borderRadius: 8,
                padding: '0 18px',
                fontWeight: 'bold'
            }
        } >
        Enviar <
        /button> < /
        form > <
        /div> < /
        div >
    )
}

{ /* ========== SETTINGS SECTION ========== */ } {
    activeSection === 'configuracoes' && ( <
            div className = "settings-section" >
            <
            h2 > Configurações da Conta < /h2>

            <
            div className = "user-settings-card" >
            <
            h3 > Informações do Usuário < /h3> <
            p >
            <
            strong > Nome de Usuário: < /strong> {userName} < /
            p > <
            p >
            <
            strong > Email: < /strong> {userEmail} < /
            p > <
            p >
            <
            button className = "edit-profile-button"
            onClick = { openEditModal } >
            Editar Perfil <
            /button> {
            whatsappNumberSaved ? ( <
                >
                <
                span style = {
                    { marginLeft: 8, color: 'green', fontWeight: 'bold' }
                } >
                Número vinculado: { whatsappNumberSaved } <
                /span> <
                button className = "edit-profile-button unlink-whatsapp-btn"
                style = {
                    { marginLeft: 8, background: 'red', color: 'white' }
                }
                onClick = { handleUnlinkWhatsapp } >
                Desvincular <
                /button> < / >
            ) : ( <
                button className = "edit-profile-button add-whatsapp-btn"
                style = {
                    { marginLeft: 8 }
                }
                onClick = {
                    () => setShowWhatsappModal(true)
                } >
                Adicionar Número <
                /button>
            )
        } <
        /p> <
    p className = "settings-note" >
        *
        Após editar ou excluir a conta, será necessário fazer login novamente. <
        /p> < /
    div >

        { /* Edit Account Modal */ } {
            showEditModal && ( <
                div className = "modal-overlay" >
                <
                div className = "modal-card" >
                <
                h3 > Editar Conta < /h3> <
                form onSubmit = { handleEditAccount } >
                <
                label > Novo Nome: < /label> <
                input type = "text"
                value = { editName }
                onChange = {
                    (e) => setEditName(e.target.value)
                }
                placeholder = "Novo nome" /
                >

                <
                label > Nova Senha: < /label> <
                input type = "password"
                value = { editPassword }
                onChange = {
                    (e) => setEditPassword(e.target.value)
                }
                placeholder = "Nova senha" /
                >

                {
                    editError && < p className = "error-message" > { editError } < /p>}

                    <
                    div className = "button-group small-buttons" >
                    <
                    button
                    type = "submit"
                    disabled = { editLoading }
                    className = "submit-button small-btn" > { editLoading ? 'Salvando...' : 'Salvar' } <
                    /button> <
                    button
                    type = "button"
                    onClick = {
                        () => {
                            setShowEditModal(false);
                            openDeleteModal();
                        }
                    }
                    className = "delete-account-button small-btn" >
                    Excluir Conta <
                    /button> <
                    button
                    type = "button"
                    onClick = {
                        () => setShowEditModal(false)
                    }
                    className = "cancel-button small-btn" >
                    Cancelar <
                    /button> < /
                    div > <
                    /form> < /
                    div > <
                    /div>
                )
            }

            { /* Delete Account Modal */ } {
                showDeleteModal && ( <
                    div className = "modal-overlay" >
                    <
                    div className = "modal-card" >
                    <
                    h3 > Excluir Conta < /h3> <
                    p >
                    Tem certeza que deseja excluir sua conta ? Esta ação é irreversível. <
                    /p> {
                    deleteError && < p className = "error-message" > { deleteError } < /p>} <
                    div className = "button-group" >
                    <
                    button onClick = { handleDeleteAccount }
                    disabled = { deleteLoading }
                    className = "delete-button" > { deleteLoading ? 'Excluindo...' : 'Excluir' } <
                    /button> <
                    button onClick = {
                        () => setShowDeleteModal(false)
                    }
                    className = "cancel-button" >
                    Cancelar <
                    /button> < /
                    div > <
                    /div> < /
                    div >
                )
            }

            { /* NOVO: Modal para adicionar número do WhatsApp */ } {
                showWhatsappModal && ( <
                        div className = "modal-overlay" >
                        <
                        div className = "modal-card" >
                        <
                        h3 >
                        Adicione seu número de Whatsapp para receber notificação do
                            EcoBot, bot inteligente da Smart Energy!
                            <
                            /h3> <
                        form onSubmit = { handleSaveWhatsapp } >
                        <
                        label > Número(com código do país, DDD e número): < /label> <
                        input type = "text"
                        value = { whatsappNumber }
                        onChange = {
                            (e) => setWhatsappNumber(e.target.value)
                        }
                        placeholder = "Ex: 5562999999999"
                        maxLength = { 13 }
                        /> {
                        whatsappError && ( <
                            p className = "error-message" > { whatsappError } < /p>
                        )
                    } {
                        whatsappSuccess && ( <
                            p className = "success-message" > { whatsappSuccess } < /p>
                        )
                    } <
                    div className = "button-group small-buttons" >
                    <
                    button type = "submit"
                className = "submit-button small-btn" >
                    Salvar <
                    /button> <
                button type = "button"
                className = "cancel-button small-btn"
                onClick = {
                        () => setShowWhatsappModal(false)
                    } >
                    Cancelar <
                    /button> < /
                div > <
                    /form> < /
                div > <
                    /div>
            )
        }

    <
    div className = "tasmota-settings-card" >
        <
        h3 > Gerenciamento de Dispositivos < /h3> <
    p className = "device-management-description" >
        Aqui você pode gerenciar seus dispositivos Tasmota. <
        /p>

    {
        isRealData ? ( <
            p >
            <
            button className = "add-device-btn"
            onClick = {
                () => navigate('/add-device')
            } >
            Adicionar Novo Dispositivo <
            /button> <
            button className = "refresh-devices-btn"
            onClick = { fetchDashboardData } >
            Atualizar Lista de Dispositivos <
            /button> < /
            p >
        ) : ( <
            p className = "admin-only-message" >
            O gerenciamento completo de dispositivos está disponível apenas para a conta de administrador. <
            /p>
        )
    } <
    /div> < /
    div >
)
} <
/div> < /
div >
);
}

export default DashboardPage;