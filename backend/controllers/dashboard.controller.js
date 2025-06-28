// backend/controllers/dashboard.controller.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Instância do Prisma

// Importa o serviço Tasmota. Ele será usado para interagir com o DB agora,
// já que as funções como getDevices, getLatestEnergyReading etc.
// devem ser implementadas lá ou diretamente aqui no controller usando prisma.
// Se essas funções já estão no tasmota.service.js, o import está correto.
// Se elas não estão e você vai implementá-las aqui, você não precisaria do import.
// Pela estrutura atual do seu código, parece que você quer que tasmotaService contenha essas funções.
const tasmotaService = require('../services/tasmota.service'); // Serviço para interagir com dados Tasmota
const energyTotalManager = require('../services/energyTotalManager'); // NOVO: Serviço para gerenciar energia total

// === Dados Fictícios (Mock Data) ===
// Estes dados serão enviados para usuários NÃO-ADMIN
const mockMetrics = {
    totalConsumption: 1850.75, // Wh (Watt-hora)
    currentPower: 450.20, // W (Watts)
    devicesOnline: 3, // Número de dispositivos "online" fictícios
    energySaved: 75.30, // Wh (Exemplo de economia fictícia)
};

const mockDevices = [
    { id: 'mockDev1', name: 'Lâmpada Sala (Fictícia)', tasmotaTopic: 'mock_lamp', powerState: true, power: 60, totalEnergy: 1500 },
    { id: 'mockDev2', name: 'Tomada Cozinha (Fictícia)', tasmotaTopic: 'mock_kitchen_outlet', powerState: false, power: 0, totalEnergy: 500 },
    { id: 'mockDev3', name: 'Ar Condicionado (Fictício)', tasmotaTopic: 'mock_ac', powerState: true, power: 1200, totalEnergy: 2500 },
    { id: 'mockDev4', name: 'Chuveiro (Fictício)', tasmotaTopic: 'mock_shower', powerState: false, power: 0, totalEnergy: 4000 },
    { id: 'mockDev5', name: 'TV Sala (Fictícia)', tasmotaTopic: 'mock_tv', powerState: true, power: 80, totalEnergy: 800 },
];

// Função para gerar dados de gráfico fictícios dinamicamente
const generateMockChartData = (period) => {
    let labels = [];
    let data = [];
    const now = new Date();

    if (period === 'day') {
        labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        data = Array.from({ length: 24 }, () => parseFloat((Math.random() * 500 + 100).toFixed(2)));
    } else if (period === 'week') {
        labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        data = Array.from({ length: 7 }, () => parseFloat((Math.random() * 3000 + 1000).toFixed(2)));
    } else { // month (default)
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            labels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
        }
        data = Array.from({ length: 30 }, () => parseFloat((Math.random() * 1000 + 200).toFixed(2)));
    }
    return { labels, data };
};

// Função para gerar dados de consumo por tipo fictícios
const generateMockConsumptionByType = () => {
    return {
        labels: ['Iluminação', 'Refrigeração', 'Aquecimento', 'Entretenimento', 'Outros'],
        data: [25, 30, 15, 20, 10], // Percentuais fictícios
        backgroundColor: [
            'rgba(255, 99, 132, 0.7)',
            'rgba(54, 162, 235, 0.7)',
            'rgba(255, 206, 86, 0.7)',
            'rgba(75, 192, 192, 0.7)',
            'rgba(153, 102, 255, 0.7)',
        ],
        hoverOffset: 4
    };
};

// === Função Principal do Controlador do Dashboard ===
async function getDashboardData(req, res) {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    const isAdmin = req.user.isAdmin; // 'isAdmin' já vem do middleware authenticateToken

    let dashboardData = {};

    try {
        if (isAdmin) {
            console.log(`Admin user ${userEmail} accessing real data.`);

            // 1. Buscar os dispositivos do usuário (com a última leitura de energia incluída)
            const userDevices = await prisma.device.findMany({
                where: { userId: userId },
                include: {
                    readings: {
                        orderBy: {
                            timestamp: 'desc',
                        },
                        take: 1, // Pega apenas a última leitura
                    },
                },
            });

            const realDevicesData = [];
            let currentRealPower = 0; // Potência instantânea total
            let devicesActuallyOnline = 0;
            let totalConsumptionAccumulated = 0; // kWh total acumulado de todos os dispositivos
            let currentMonthConsumption = 0; // kWh do mês atual
            let dailyConsumptionLastDay = 0; // kWh do último dia com dados

            // Para o gráfico de consumo por tipo (pizza)
            const energyConsumptionByDeviceType = {}; // Para agregar por tipo de dispositivo
            const consumptionByTypeColors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#8D6E63', '#26A69A'
            ];

            // Para o gráfico principal (consumo diário nos últimos 7 dias)
            const mainChartLabels = [];
            const mainChartDataValues = Array(7).fill(0); // Inicializa com 0 para 7 dias
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Zera hora para comparação de dia

            for (let i = 6; i >= 0; i--) { // Últimos 7 dias, incluindo hoje
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                mainChartLabels.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })); // Ex: 26/06
            }

            // --- Processar cada dispositivo para coletar dados ---
            for (const device of userDevices) {
                const latestReading = device.readings.length > 0 ? device.readings[0] : null;

                // NOVO: Obter o valor atual de energia total para exibição (valor acumulado do Tasmota)
                const currentTotalEnergyForDisplay = await energyTotalManager.getAccumulatedTotalEnergy(device.id);

                realDevicesData.push({
                    id: device.id,
                    name: device.name,
                    tasmotaTopic: device.tasmotaTopic,
                    macAddress: device.macAddress,
                    model: device.model,
                    powerState: device.powerState, // PowerState vem do modelo Device
                    latestReading: latestReading ? {
                        power: latestReading.power, // W
                        voltage: latestReading.voltage, // V
                        current: latestReading.current, // A
                        totalEnergy: currentTotalEnergyForDisplay, // NOVO: Valor acumulado atual do Tasmota para exibição
                        EnergyToday: latestReading.EnergyToday,
                        EnergyYesterday: latestReading.EnergyYesterday,
                        ApparentPower: latestReading.ApparentPower,
                        ReactivePower: latestReading.ReactivePower,
                        PowerFactor: latestReading.PowerFactor,
                        timestamp: latestReading.timestamp,
                    } : null,
                });

                if (latestReading) {
                    currentRealPower += latestReading.power; // Soma a potência instantânea

                    // NOVO: Usar o valor acumulado atual para cálculos de consumo total
                    const totalEnergyForCalculations = currentTotalEnergyForDisplay || 0;
                    totalConsumptionAccumulated += totalEnergyForCalculations;

                    // Acumular consumo para o gráfico de pizza (por tipo de dispositivo/nome)
                    if (totalEnergyForCalculations > 0) {
                        const deviceTypeName = device.model || 'Outros'; // Usa o modelo do dispositivo para tipagem
                        energyConsumptionByDeviceType[deviceTypeName] = (energyConsumptionByDeviceType[deviceTypeName] || 0) + totalEnergyForCalculations;
                    }
                }

                // --- Calcular consumo para o mês atual e último dia com dados ---
                // Para simplificar: obter todas as leituras do mês atual e do último dia para este dispositivo.
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const startOfLastDay = new Date(today);
                startOfLastDay.setDate(today.getDate() - 1); // Pega o dia anterior
                startOfLastDay.setHours(0, 0, 0, 0);

                const endOfLastDay = new Date(startOfLastDay);
                endOfLastDay.setDate(startOfLastDay.getDate() + 1);

                // NOVO: Buscar leituras que tenham totalEnergy (apenas as salvas no último dia do mês)
                const monthReadings = await prisma.energyReading.findMany({
                    where: {
                        deviceId: device.id,
                        timestamp: {
                            gte: startOfMonth,
                            lte: today, // Até o dia atual
                        },
                        totalEnergy: { not: null } // NOVO: Apenas leituras com totalEnergy (último dia do mês)
                    },
                    orderBy: { timestamp: 'asc' }, // Ordena para calcular o diff
                });

                // NOVO: Calcula o consumo mensal para este dispositivo usando apenas os dados salvos no último dia
                if (monthReadings.length > 1) {
                    const firstReadingMonth = monthReadings[0].totalEnergy;
                    const lastReadingMonth = monthReadings[monthReadings.length - 1].totalEnergy;
                    currentMonthConsumption += (lastReadingMonth - firstReadingMonth);
                } else if (monthReadings.length === 1 && monthReadings[0].totalEnergy) {
                    // Se só tiver uma leitura no mês, considera o valor como consumo
                    currentMonthConsumption += monthReadings[0].totalEnergy;
                }

                // NOVO: Para o consumo do último dia, usar apenas leituras com totalEnergy
                const lastDayReadings = await prisma.energyReading.findMany({
                    where: {
                        deviceId: device.id,
                        timestamp: {
                            gte: startOfLastDay,
                            lt: endOfLastDay,
                        },
                        totalEnergy: { not: null } // NOVO: Apenas leituras com totalEnergy
                    },
                    orderBy: { timestamp: 'asc' },
                });

                if (lastDayReadings.length > 1) {
                    const firstReadingLastDay = lastDayReadings[0].totalEnergy;
                    const lastReadingLastDay = lastDayReadings[lastDayReadings.length - 1].totalEnergy;
                    dailyConsumptionLastDay += (lastReadingLastDay - firstReadingLastDay);
                } else if (lastDayReadings.length === 1 && lastDayReadings[0].totalEnergy) {
                    dailyConsumptionLastDay += lastDayReadings[0].totalEnergy;
                }

                // NOVO: Para o gráfico histórico, usar apenas leituras com totalEnergy
                const recentReadings = await prisma.energyReading.findMany({
                    where: {
                        deviceId: device.id,
                        timestamp: {
                            gte: new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000)), // 7 dias atrás
                            lte: today,
                        },
                        totalEnergy: { not: null } // NOVO: Apenas leituras com totalEnergy
                    },
                    orderBy: {
                        timestamp: 'asc', // Importante para calcular diferenças ou agregação
                    },
                });

                // Agregação de consumo diário para o gráfico:
                // Esta lógica precisa calcular a diferença de 'totalEnergy' por dia.
                const dailyAggregatedConsumption = {};
                if (recentReadings.length > 0) {
                    let prevReading = recentReadings[0];
                    for (let i = 1; i < recentReadings.length; i++) {
                        const currentReading = recentReadings[i];
                        const prevDate = new Date(prevReading.timestamp);
                        prevDate.setHours(0, 0, 0, 0);
                        const currentDate = new Date(currentReading.timestamp);
                        currentDate.setHours(0, 0, 0, 0);

                        // Se a data mudou (novo dia) ou é a primeira leitura do dia, calcula a diferença
                        if (currentDate.getTime() !== prevDate.getTime() || i === 1) {
                            const consumptionDiff = currentReading.totalEnergy - prevReading.totalEnergy;
                            if (consumptionDiff > 0) { // Garante que a diferença é positiva
                                const dateKey = currentDate.toISOString().split('T')[0]; // 'YYYY-MM-DD'
                                dailyAggregatedConsumption[dateKey] = (dailyAggregatedConsumption[dateKey] || 0) + consumptionDiff;
                            }
                        }
                        prevReading = currentReading;
                    }
                }

                // Mapeia os dados agregados para o array mainChartDataValues
                mainChartLabels.forEach((label, index) => {
                    const dateForLabel = new Date(today);
                    dateForLabel.setDate(today.getDate() - (6 - index));
                    const dateKey = dateForLabel.toISOString().split('T')[0];
                    if (dailyAggregatedConsumption[dateKey]) {
                        mainChartDataValues[index] += dailyAggregatedConsumption[dateKey];
                    }
                });
            }

            // Finaliza as métricas globais
            // Se o totalEnergy no Tasmota for acumulativo e não reiniciar, o totalConsumptionAccumulated
            // pode ser apenas a soma do latestReading.totalEnergy de todos os dispositivos.
            // A "fatura estimada" no frontend usa currentMonthConsumption.
            // dailyConsumption é o consumo do último dia.

            dashboardData = {
                isRealData: true,
                userEmail: userEmail,
                userDevices: realDevicesData, // O frontend espera 'userDevices'
                metrics: {
                    // Convertendo Wh para kWh para exibição no frontend (dividir por 1000)
                    // Mas o seu schema.prisma tem Float, e Energy.Total do Tasmota é kWh.
                    // Então, vamos manter kWh, se o Tasmota manda kWh.
                    // Se o Tasmota manda Wh, ajuste no schema para Wh ou converta aqui.
                    // Assumindo que totalEnergy do Tasmota (e no DB) já é em kWh:
                    currentMonthConsumption: parseFloat(currentMonthConsumption.toFixed(2)),
                    dailyConsumption: parseFloat(dailyConsumptionLastDay.toFixed(2)), // Consumo do último dia
                    totalConsumption: parseFloat(totalConsumptionAccumulated.toFixed(2)), // Total acumulado de todos
                    currentPower: parseFloat(currentRealPower.toFixed(2)), // Potência instantânea total em Watts
                    devicesOnline: devicesActuallyOnline,
                    energySaved: 0, // Lógica complexa, por enquanto 0
                },
                // O frontend espera 'labels' e 'datasets' para o gráfico principal
                mainChartData: {
                    labels: mainChartLabels,
                    datasets: [{
                        label: 'Consumo Diário (kWh)',
                        data: mainChartDataValues.map(val => parseFloat(val.toFixed(2))),
                        borderColor: '#00bcd4', // Cores do seu frontend
                        backgroundColor: 'rgba(0, 188, 212, 0.4)',
                        tension: 0.4,
                        fill: true,
                    }],
                },
                // O frontend espera 'labels' e 'datasets' para o gráfico de pizza
                consumptionByTypeChartData: {
                    labels: Object.keys(energyConsumptionByDeviceType),
                    datasets: [{
                        data: Object.values(energyConsumptionByDeviceType).map(val => parseFloat(val.toFixed(2))),
                        backgroundColor: consumptionByTypeColors.slice(0, Object.keys(energyConsumptionByDeviceType).length),
                        borderColor: consumptionByTypeColors.slice(0, Object.keys(energyConsumptionByDeviceType).length).map(color => color.replace('0.7', '1')), // Torna a borda mais opaca
                        borderWidth: 1,
                    }],
                },
                deviceSuggestions: [], // As sugestões virão do frontend ou de uma lógica mais avançada
                // A lista de controle do dispositivo já está dentro de userDevices para o frontend
                // deviceControlList: realDevicesData, // Removido, userDevices já inclui isso
                reports: {
                    summary: `Relatório de consumo real para o usuário ${userEmail}.`,
                    deviceReports: realDevicesData.map(d => ({
                        id: d.id,
                        name: d.name,
                        status: d.powerState ? 'LIGADO' : 'DESLIGADO',
                        lastReport: d.latestReading ? `Potência: ${d.latestReading.power}W, Total Acumulado: ${d.latestReading.totalEnergy} kWh` : 'Sem dados',
                        impact: (d.latestReading && d.latestReading.power > 100) ? 'Alto Consumo' : 'Consumo Normal'
                    }))
                },
                // NOVO: Sempre envie o campo daily_consumption_kwh para o frontend
                daily_consumption_kwh: mainChartDataValues.map(val => parseFloat(val.toFixed(2))),
            };

        } else {
            console.log(`