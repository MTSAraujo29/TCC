import React, { useEffect, useState, useCallback } from 'react'; // Adicionado useCallback
import { useNavigate } from 'react-router-dom';
import '../App.css'; // Certifique-se de que este caminho está correto

// Importações do Chart.js
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Registra os componentes necessários do Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement);

// URL do seu backend
const BACKEND_URL = 'http://localhost:5000'; // Mantenha isso configurável se for para produção

function DashboardPage() {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
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

    // NOVO: Estado para o status da conexão eWeLink
    const [ewelinkConnected, setEwelinkConnected] = useState(false);
    const [ewelinkMessage, setEwelinkMessage] = useState(''); // Mensagens para a conexão eWeLink
    const [ewelinkDevices, setEwelinkDevices] = useState([]); // Dispositivos reais da eWeLink

    // Dados fictícios para os modos de visualização do gráfico principal.
    const mockDailyData = {
        labels: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"],
        datasets: [{
            label: 'Consumo Diário (kWh)',
            data: [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9],
            borderColor: '#00bcd4',
            backgroundColor: 'rgba(0, 188, 212, 0.4)',
            tension: 0.4,
            fill: true,
        }, ],
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
        }, ],
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
        }, ],
    };

    const getConsumptionByTypeData = () => {
        // Em uma aplicação real, você agregaria o consumo dos 'devices' por 'type'
        // ou dos ewelinkDevices se eles tiverem informações de tipo e consumo
        const deviceTypes = ['Lâmpada', 'Ar Condicionado', 'TV', 'Geladeira', 'Computador'];
        const data = [15.5, 30.2, 10.8, 25.0, 8.7];
        const backgroundColors = ['#00bcd4', '#ff9800', '#e91e63', '#4caf50', '#9c27b0'];
        const borderColors = ['#00838f', '#f57c00', '#c2185b', '#388e3c', '#7b1fa2'];

        return {
            labels: deviceTypes,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
            }, ],
        };
    };

    const getSuggestedDevicesData = () => {
        // Você pode basear as sugestões nos dispositivos reais da eWeLink
        return [
            { id: 1, name: 'Lâmpada do Quarto', suggestion: 'Instalar temporizador para desligar automaticamente.' },
            { id: 2, name: 'Ar Condicionado da Sala', suggestion: 'Configurar automação para ajustar temperatura ao sair.' },
            { id: 3, name: 'Geladeira', suggestion: 'Verificar vedação da porta para evitar perda de energia.' },
            { id: 4, name: 'TV da Sala', suggestion: 'Ativar modo de economia de energia nas configurações.' },
        ];
    };

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
                    callback: function(value) { return value + ' kWh'; }
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
                        if (label) { label += ': '; }
                        if (context.parsed !== null) { label += context.parsed.toFixed(2) + ' kWh'; }
                        return label;
                    }
                }
            }
        },
    };

    // Função para exibir mensagens na UI
    const displayEwelinkMessage = useCallback((message, type = 'info') => {
        setEwelinkMessage(message);
        // Em um projeto real, você pode querer adicionar uma classe para o tipo da mensagem
        // e usar CSS para estilizar (ex: setEwelinkMessage({ text: message, type: type }));
        setTimeout(() => setEwelinkMessage(''), 5000); // Limpa a mensagem após 5 segundos
    }, []);

    // NOVO: Função para carregar dispositivos eWeLink
    const loadEwelinkDevices = useCallback(async() => {
        const token = localStorage.getItem('token');
        if (!token) {
            displayEwelinkMessage('Você não está logado no sistema.', 'error');
            setEwelinkConnected(false);
            setEwelinkDevices([]);
            return;
        }

        displayEwelinkMessage('Verificando conexão eWeLink e carregando dispositivos...', 'info');

        try {
            const response = await fetch(`${BACKEND_URL}/api/ewelink/devices`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                setEwelinkConnected(true);
                setEwelinkDevices(data.devices || []);
                displayEwelinkMessage('Dispositivos eWeLink carregados com sucesso!', 'success');
            } else {
                setEwelinkConnected(false);
                setEwelinkDevices([]);
                displayEwelinkMessage(data.message || 'Erro ao carregar dispositivos eWeLink.', 'error');
                console.error('Erro ao buscar dispositivos eWeLink:', data.message);
            }
        } catch (error) {
            setEwelinkConnected(false);
            setEwelinkDevices([]);
            displayEwelinkMessage('Erro de rede ou servidor ao tentar conectar à eWeLink.', 'error');
            console.error('Erro de rede/servidor ao carregar dispositivos eWeLink:', error);
        }
    }, [displayEwelinkMessage]);


    // NOVO: Função para iniciar o fluxo OAuth da eWeLink
    const handleConnectEwelink = async() => {
        const token = localStorage.getItem('token');
        if (!token) {
            displayEwelinkMessage('Você precisa estar logado no seu sistema para conectar a eWeLink.', 'error');
            return;
        }
        try {
            const response = await fetch(`${BACKEND_URL}/api/ewelink/authorize`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.url) {
                    displayEwelinkMessage('Redirecionando para a eWeLink...', 'info');
                    window.location.href = data.url;
                } else {
                    displayEwelinkMessage('Erro ao obter URL de autorização da eWeLink.', 'error');
                }
            } else {
                const data = await response.json();
                displayEwelinkMessage(data.message || 'Erro ao conectar com a eWeLink.', 'error');
            }
        } catch (error) {
            displayEwelinkMessage('Erro de rede ao tentar conectar com a eWeLink.', 'error');
        }
    };


    useEffect(() => {
        const token = localStorage.getItem('token');
        const storedUserName = localStorage.getItem('userName');
        const storedUserEmail = localStorage.getItem('userEmail');

        if (!token) {
            navigate('/login');
            return;
        }

        setUserName(storedUserName ? storedUserName.split('@')[0] : '');
        setUserEmail(storedUserEmail || '');

        const fetchDashboardData = async() => {
            try {
                const response = await fetch(`${BACKEND_URL}/api/dashboard/data`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Dados do Dashboard (internos) recebidos:', data);

                    const totalConsumptionKwh = data.daily_consumption_kwh.reduce((sum, val) => sum + val, 0);
                    setCurrentMonthConsumption(`${totalConsumptionKwh.toFixed(2)} kWh`);
                    setTotalConsumption(`${totalConsumptionKwh.toFixed(2)} kWh`);

                    if (data.daily_consumption_kwh.length > 0) {
                        setDailyConsumption(`${data.daily_consumption_kwh[data.daily_consumption_kwh.length - 1].toFixed(2)} kWh`);
                    } else {
                        setDailyConsumption('0.00 kWh');
                    }

                    // Seus dados mock para outros gráficos ou se eWeLink não estiver conectada
                    setDevices(data.devices || []);

                    // Tenta carregar dispositivos eWeLink após o carregamento inicial do dashboard
                    loadEwelinkDevices();

                } else if (response.status === 401 || response.status === 403) {
                    alert('Sua sessão expirou ou é inválida. Por favor, faça login novamente.');
                    localStorage.removeItem('token');
                    localStorage.removeItem('userName');
                    localStorage.removeItem('userEmail');
                    navigate('/login');
                } else {
                    console.error('Erro ao carregar dados do Dashboard:', response.status);
                }
            } catch (error) {
                console.error('Erro de rede ao buscar dados do dashboard:', error);
            }
        };

        fetchDashboardData();
    }, [navigate, loadEwelinkDevices]); // Adicionado loadEwelinkDevices como dependência

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('userEmail');
        navigate('/login');
    };

    const toggleDeviceStatus = (id) => {
        setDevices(prevDevices =>
            prevDevices.map(device => {
                if (device.id === id) {
                    const newStatus = device.status === 'on' ? 'off' : 'on';
                    setDeviceMessage(`Dispositivo "${device.name}" ${newStatus === 'on' ? 'Ligado' : 'Desligado'}.`);
                    setTimeout(() => setDeviceMessage(''), 3000);
                    return {...device, status: newStatus };
                }
                return device;
            })
        );
    };

    // FUNÇÃO PARA GERAR O RELATÓRIO FICTÍCIO
    const generateFictionalReport = useCallback(() => { // Usando useCallback
        let totalFictionalSavings = 0;
        let totalFictionalOverspend = 0;
        let smartUsageCount = 0;
        let nonSmartUsageCount = 0;

        // Use ewelinkDevices se estiverem disponíveis, senão use 'devices'
        const devicesToReport = ewelinkDevices.length > 0 ? ewelinkDevices : devices;

        const reportDetails = devicesToReport.map(device => {
            const currentConsumption = device.consumption_kwh || 0.1;
            let recommendation = "";
            let potentialImpact = 0;

            // Adapte a lógica para os dados reais da eWeLink se disponíveis
            if (device.type === 'switch' && device.status === 'on' && Math.random() > 0.7) {
                recommendation = "Sugerimos uso de temporizadores ou automação para desligar automaticamente.";
                potentialImpact = -(currentConsumption * 5);
                nonSmartUsageCount++;
            } else if (device.type === 'light' && device.status === 'on' && Math.random() > 0.5) {
                recommendation = "Verificar se está utilizando lâmpadas LED de baixo consumo.";
                potentialImpact = -(currentConsumption * 2);
                nonSmartUsageCount++;
            } else if (device.status === 'off' && Math.random() > 0.3) {
                recommendation = "Dispositivo desligado. Ótima gestão de energia!";
                potentialImpact = currentConsumption * 2;
                smartUsageCount++;
            } else {
                recommendation = "Uso consistente. Considere automação para otimização.";
                potentialImpact = 0;
            }

            if (potentialImpact < 0) {
                totalFictionalOverspend += Math.abs(potentialImpact);
            } else {
                totalFictionalSavings += potentialImpact;
            }

            return {
                name: device.name,
                status: device.status === 'on' ? 'Ligado' : 'Desligado',
                type: device.type,
                recommendation: recommendation,
                potentialImpact: potentialImpact.toFixed(2)
            };
        });

        const overallImpact = totalFictionalSavings - totalFictionalOverspend;
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
                totalFictionalSavings: totalFictionalSavings.toFixed(2),
                totalFictionalOverspend: totalFictionalOverspend.toFixed(2),
                overallMessage: overallMessage
            },
            details: reportDetails
        };
    }, [devices, ewelinkDevices]); // Dependências para useCallback

    const fictionalReport = generateFictionalReport();

    return ( <
        div className = "container dashboard-container" > { /* Sidebar de Navegação */ } <
        div className = "sidebar" >
        <
        div className = "logo-icon-sidebar" > ⚡ < /div> <
        div className = { `menu-item ${activeSection === 'inicio' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('inicio')
        } > 🏠Início <
        /div> <
        div className = { `menu-item ${activeSection === 'controle' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('controle')
        } > 🔌Controle de Energia <
        /div> <
        div className = { `menu-item ${activeSection === 'relatorios' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('relatorios')
        } > 📊Relatórios <
        /div> <
        div className = { `menu-item ${activeSection === 'configuracoes' ? 'active' : ''}` }
        onClick = {
            () => setActiveSection('configuracoes')
        } > ⚙️Configurações <
        /div> <
        div className = "sidebar-bottom" >
        <
        button onClick = { handleLogout }
        className = "menu-item logout-link-sidebar" > 🔒Sair < /button> < /
        div > <
        /div>

        { /* Conteúdo Principal do Dashboard */ } <
        div className = "main-content" > { /* Seção "Início" */ } {
            activeSection === 'inicio' && ( <
                >
                <
                h2 > Olá, { userName }! < /h2> <
                div className = "metrics-grid" >
                <
                div className = "metric-card" >
                <
                h3 > Consumo de energia atual < /h3> <
                p > { dailyConsumption } < /p> < /
                div > <
                div className = "metric-card" >
                <
                h3 > Consumo do mês atual < /h3> <
                p > { currentMonthConsumption } < /p> < /
                div > <
                div className = "metric-card" >
                <
                h3 > Fatura Estimada < /h3> <
                p > R$ {
                    (parseFloat(currentMonthConsumption.replace(' kWh', '')) * 0.75).toFixed(2)
                } < /p> < /
                div > <
                div className = "metric-card" >
                <
                h3 > Consumo total < /h3> <
                p > { totalConsumption } < /p> < /
                div > <
                /div>

                <
                div className = "chart-area-main" >
                <
                div className = "chart-card-main" >
                <
                div className = "view-mode-buttons" >
                <
                button onClick = {
                    () => setViewMode('day')
                }
                className = { viewMode === 'day' ? 'active-view-button' : 'view-button' } >
                Dia <
                /button> <
                button onClick = {
                    () => setViewMode('week')
                }
                className = { viewMode === 'week' ? 'active-view-button' : 'view-button' } >
                Semana <
                /button> <
                button onClick = {
                    () => setViewMode('month')
                }
                className = { viewMode === 'month' ? 'active-view-button' : 'view-button' } >
                Mês <
                /button> < /
                div > {
                    getChartData().labels.length > 0 ? ( <
                        Line data = { getChartData() }
                        options = { chartOptions }
                        />
                    ) : ( <
                        p style = {
                            { color: '#BBB', textAlign: 'center' }
                        } > Carregando dados do gráfico... < /p>
                    )
                } <
                /div> < /
                div >

                <
                div className = "bottom-sections-grid" >
                <
                div className = "bottom-card consumption-by-type-card" >
                <
                h3 > Consumo por Tipo de Dispositivo < /h3> <
                div className = "chart-wrapper" >
                <
                Doughnut data = { getConsumptionByTypeData() }
                options = { consumptionByTypeOptions }
                /> < /
                div > <
                /div>

                <
                div className = "bottom-card suggested-devices-card" >
                <
                h3 > Dispositivos Sugeridos < /h3> <
                p style = {
                    { color: '#BBB', fontSize: '0.9em', marginBottom: '15px' }
                } >
                Sugestões para otimizar o consumo de energia em seus dispositivos. <
                /p> <
                ul className = "device-suggestion-list" > {
                    getSuggestedDevicesData().length > 0 ? (
                        getSuggestedDevicesData().map(device => ( <
                            li key = { device.id } >
                            <
                            strong > { device.name }: < /strong> {device.suggestion} < /
                            li >
                        ))
                    ) : ( <
                        p style = {
                            { color: '#BBB', textAlign: 'center' }
                        } > Nenhuma sugestão no momento. < /p>
                    )
                } <
                /ul> < /
                div > <
                /div> < /
                >
            )
        }

        { /* Seção "Controle de Energia" */ } {
            activeSection === 'controle' && ( <
                div className = "energy-control-section" >
                <
                h2 > Controle de Dispositivos < /h2> {
                deviceMessage && < p className = "device-feedback-message" > { deviceMessage } < /p>} {
                ewelinkMessage && ( <
                    p className = { `message ${ewelinkMessage.includes('sucesso') ? 'success' : 'error'}` } > { ewelinkMessage } <
                    /p>
                )
            }

            { /* NOVO: Exibição e controle dos dispositivos eWeLink */ } <
            h3 > Dispositivos eWeLink < /h3> {
            ewelinkConnected ? (
                ewelinkDevices.length > 0 ? ( <
                    div className = "device-control-list" > {
                        ewelinkDevices.map(device => ( <
                            div key = { device.deviceid }
                            className = "device-control-item" > { /* Adapte 'name', 'type', 'status' conforme a estrutura real dos seus dispositivos da eWeLink */ } <
                            span className = "device-control-name" > { device.name }({ device.extra.extra.uiid }) < /span> <
                            span className = { `device-status-indicator ${device.online ? 'on' : 'off'}` } > { device.online ? 'Online' : 'Offline' } <
                            /span> { / * Exemplo de botão para alternar o status, se a eWeLink API suportar * / } { / * Você precisará de um endpoint no seu backend para controlar um dispositivo eWeLink * / } <
                            button
                            // onClick={() => toggleEwelinkDeviceStatus(device.deviceid, device.params.switch)}
                            className = { `device-toggle-button ${device.params && device.params.switch === 'on' ? 'on' : 'off'}` }
                            disabled = {!device.online } // Desabilita se o dispositivo estiver offline
                            >
                            { device.params && device.params.switch === 'on' ? 'Desligar' : 'Ligar' } <
                            /button> < /
                            div >
                        ))
                    } <
                    /div>
                ) : ( <
                    p style = {
                        { color: '#BBB', textAlign: 'center' }
                    } > Nenhum dispositivo eWeLink encontrado. < /p>
                )
            ) : ( <
                p style = {
                    { color: '#BBB', textAlign: 'center' }
                } >
                A eWeLink não está conectada.Por favor, conecte na seção "Configurações". <
                /p>
            )
        } <
        button onClick = { loadEwelinkDevices }
        disabled = {!ewelinkConnected }
        className = "refresh-devices-btn" >
        Atualizar Dispositivos eWeLink <
        /button>

        <
        h3 style = {
            { marginTop: '30px' }
        } > Outros Dispositivos(Mock) < /h3> <
        div className = "device-control-list" > {
            devices.length > 0 ? (
                devices.map(device => ( <
                    div key = { device.id }
                    className = "device-control-item" >
                    <
                    span className = "device-control-name" > { device.name }({ device.type }) < /span> <
                    span className = { `device-status-indicator ${device.status}` } > { device.status === 'on' ? 'Ligado' : 'Desligado' } <
                    /span> <
                    button onClick = {
                        () => toggleDeviceStatus(device.id)
                    }
                    className = { `device-toggle-button ${device.status}` } > { device.status === 'on' ? 'Desligar' : 'Ligar' } <
                    /button> < /
                    div >
                ))
            ) : ( <
                p style = {
                    { color: '#BBB', textAlign: 'center' }
                } > Nenhum dispositivo mock para controle. < /p>
            )
        } <
        /div> < /
        div >
    )
}

{ /* Seção "Relatórios" */ } {
    activeSection === 'relatorios' && ( <
            div className = "reports-section" >
            <
            h2 > Relatórios de Consumo < /h2> <
            div className = "report-summary-card" >
            <
            h3 > Resumo Geral < /h3> <
            p > Total de Dispositivos: < strong > { fictionalReport.summary.totalDevices } < /strong></p >
            <
            p > Dispositivos com Uso Inteligente(estimado): < strong > { fictionalReport.summary.smartUsageDevices } < /strong></p >
            <
            p > Dispositivos com Otimização Pendente(estimado): < strong > { fictionalReport.summary.nonSmartUsageDevices } < /strong></p >
            <
            p className = "overall-report-message" > { fictionalReport.summary.overallMessage } <
            /p> < /
            div >

            <
            h3 > Detalhes por Dispositivo < /h3> <
            div className = "device-report-list" > {
                fictionalReport.details.length > 0 ? (
                    fictionalReport.details.map((detail, index) => ( <
                            div key = { index }
                            className = "device-report-item" >
                            <
                            h4 > { detail.name } < /h4> <
                            p > Status Atual: < span className = { detail.status === 'Ligado' ? 'status-on-text' : 'status-off-text' } > { detail.status } < /span></p >
                            <
                            p > Tipo: { detail.type } < /p> <
                            p > Recomendação: { detail.recommendation } < /p> {
                            parseFloat(detail.potentialImpact) !== 0.00 && ( <
                                p className = { parseFloat(detail.potentialImpact) > 0 ? 'impact-positive' : 'impact-negative' } >
                                Impacto Potencial: { detail.potentialImpact }
                                kWh no próximo mês <
                                /p>
                            )
                        } <
                        /div>
                    ))
            ): ( <
                p style = {
                    { color: '#BBB', textAlign: 'center' }
                } > Nenhum relatório disponível. < /p>
            )
        } <
        /div> < /
        div >
)
}

{ /* Seção "Configurações" */ } {
    activeSection === 'configuracoes' && ( <
            div className = "settings-section" >
            <
            h2 > Configurações da Conta < /h2> <
            div className = "user-settings-card" >
            <
            h3 > Informações do Usuário < /h3> <
            p > < strong > Nome de Usuário: < /strong> {userName}</p >
            <
            p > < strong > Email: < /strong> {userEmail}</p >
            <
            p >
            <
            button className = "change-password-button" > Alterar Senha < /button> <
            button className = "edit-profile-button" > Editar Perfil < /button> < /
            p > <
            p style = {
                { marginTop: '20px', fontSize: '0.9em', color: '#888' }
            } >
            *
            Funcionalidades de alterar senha e editar perfil são fictícias neste momento. <
            /p> < /
            div >

            { /* NOVO: Seção de Conexão eWeLink nas Configurações */ } <
            div className = "ewelink-settings-card" >
            <
            h3 > Conexão eWeLink < /h3> {
            ewelinkMessage && ( <
                p className = { `message ${ewelinkMessage.includes('sucesso') ? 'success' : 'error'}` } > { ewelinkMessage } <
                /p>
            )
        } <
        p > Status da Conexão: < strong style = {
            { color: ewelinkConnected ? '#4CAF50' : '#dc3545' }
        } > { ewelinkConnected ? 'Conectado' : 'Desconectado' } <
        /strong></p > {!ewelinkConnected ? ( <
                button onClick = { handleConnectEwelink }
                className = "connect-ewelink-btn" >
                Conectar Minha Conta eWeLink <
                /button>
            ) : ( <
                p style = {
                    { color: '#BBB', fontSize: '0.9em' }
                } >
                Sua conta eWeLink já está conectada. <
                br / >
                Se precisar reconectar, clique < a href = "#"
                onClick = {
                    () => { /* Lógica para desconectar e reconectar */ }
                } > aqui < /a>. < /
                p >
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