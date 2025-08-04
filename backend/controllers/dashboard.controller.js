/**
 * Controller do Dashboard
 * 
 * Gerencia todas as operações relacionadas ao painel de controle,
 * incluindo métricas de consumo, dados para gráficos e informações
 * de dispositivos. Implementa sistema dual com dados reais para
 * administradores e dados fictícios para usuários comuns.
 * 
 * Funcionalidades principais:
 * - Consolidação de métricas de energia
 * - Geração de dados para gráficos temporais
 * - Gerenciamento de cache para otimização
 * - Sistema de mock data para demonstração
 * - Integração com serviços Tasmota
 * 
 * @module DashboardController
 * @requires @prisma/client
 * @requires ../services/tasmota.service
 */

const { PrismaClient } = require("@prisma/client");
const tasmotaService = require("../services/tasmota.service");

// === CONFIGURAÇÃO GLOBAL ===
const prisma = new PrismaClient();

// === SISTEMA DE CACHE ===
// Cache para evitar logs repetitivos e otimizar performance
const lastLoggedData = new Map();
const adminUserLogCache = new Map();

/**
 * Limpa entradas antigas do cache (mais de 1 hora)
 * Executada automaticamente para prevenir vazamentos de memória
 */
function cleanupOldCache() {
  const oneHourAgo = Date.now() - 3600000; // 1 hora em ms
  
  // Limpa cache de dados de dispositivos
  for (const [deviceId, data] of lastLoggedData.entries()) {
    if (data.timestamp < oneHourAgo) {
      lastLoggedData.delete(deviceId);
    }
  }
  
  // Limpa cache de logs de usuário admin
  for (const [userId, data] of adminUserLogCache.entries()) {
    if (data.timestamp < oneHourAgo) {
      adminUserLogCache.delete(userId);
    }
  }
}

// Executa limpeza automática a cada 30 minutos
setInterval(cleanupOldCache, 1800000);

/**
 * Verifica se houve mudança significativa nos dados do dispositivo
 * 
 * Implementa lógica inteligente para evitar logs excessivos,
 * considerando mudanças de estado, variações de potência e tempo.
 * 
 * @param {string} deviceId - ID do dispositivo
 * @param {Object} currentReading - Leitura atual de energia
 * @param {boolean} devicePowerState - Estado atual do dispositivo
 * @returns {boolean} True se houve mudança significativa
 */
function hasSignificantChange(deviceId, currentReading, devicePowerState) {
  const lastData = lastLoggedData.get(deviceId);

  // Primeira leitura do dispositivo - sempre registra
  if (!lastData) {
    lastLoggedData.set(deviceId, {
      power: currentReading ? currentReading.power : 0,
      totalEnergy: currentReading ? currentReading.totalEnergy : 0,
      powerState: devicePowerState,
      timestamp: Date.now(),
    });
    return true;
  }

  // Calcula diferenças entre leitura atual e anterior
  const powerDiff = Math.abs(
    (currentReading ? currentReading.power : 0) - lastData.power
  );
  const energyDiff = Math.abs(
    (currentReading ? currentReading.totalEnergy : 0) - lastData.totalEnergy
  );
  const stateChanged = devicePowerState !== lastData.powerState;
  const timeDiff = Date.now() - lastData.timestamp;

  // Critérios para mudança significativa:
  // 1. Estado ligado/desligado mudou
  // 2. Potência variou mais de 1W
  // 3. Energia total variou mais de 0.01 kWh
  // 4. Passou mais de 5 minutos desde último log
  const significantChange =
    stateChanged || powerDiff > 1 || energyDiff > 0.01 || timeDiff > 300000;

  if (significantChange) {
    // Atualiza cache com novos valores
    lastLoggedData.set(deviceId, {
      power: currentReading ? currentReading.power : 0,
      totalEnergy: currentReading ? currentReading.totalEnergy : 0,
      powerState: devicePowerState,
      timestamp: Date.now(),
    });
  }

  return significantChange;
}

// === DADOS FICTÍCIOS (MOCK DATA) ===
// Sistema de demonstração para usuários não-administradores

/**
 * Métricas fictícias para demonstração
 * Simula dados realistas de consumo energético
 */
const mockMetrics = {
  totalConsumption: 1850.75, // Wh (Watt-hora)
  currentPower: 450.2, // W (Watts)
  devicesOnline: 3, // Dispositivos "online" fictícios
  energySaved: 75.3, // Wh (Economia simulada)
};

/**
 * Lista de dispositivos fictícios para demonstração
 * Representa cenário típico de casa inteligente
 */
const mockDevices = [
  {
    id: "mockDev1",
    name: "Lâmpada Sala (Fictícia)",
    tasmotaTopic: "mock_lamp",
    powerState: true,
    power: 60,
    totalEnergy: 1500,
  },
  {
    id: "mockDev2",
    name: "Tomada Cozinha (Fictícia)",
    tasmotaTopic: "mock_kitchen_outlet",
    powerState: false,
    power: 0,
    totalEnergy: 500,
  },
  {
    id: "mockDev3",
    name: "Ar Condicionado (Fictício)",
    tasmotaTopic: "mock_ac",
    powerState: true,
    power: 1200,
    totalEnergy: 2500,
  },
  {
    id: "mockDev4",
    name: "Chuveiro (Fictício)",
    tasmotaTopic: "mock_shower",
    powerState: false,
    power: 0,
    totalEnergy: 4000,
  },
  {
    id: "mockDev5",
    name: "TV Sala (Fictícia)",
    tasmotaTopic: "mock_tv",
    powerState: true,
    power: 80,
    totalEnergy: 800,
  },
];

/**
 * Gera dados fictícios para gráficos baseados no período
 * 
 * @param {string} period - Período do gráfico (day/week/month)
 * @returns {Object} Dados formatados para Chart.js
 */
const generateMockChartData = (period) => {
  let labels = [];
  let data = [];
  const now = new Date();

  if (period === "day") {
    labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    data = Array.from({ length: 24 }, () =>
      parseFloat((Math.random() * 500 + 100).toFixed(2))
    );
  } else if (period === "week") {
    labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    data = Array.from({ length: 7 }, () =>
      parseFloat((Math.random() * 3000 + 1000).toFixed(2))
    );
  } else {
    // month (default)
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      labels.push(
        d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
      );
    }
    data = Array.from({ length: 30 }, () =>
      parseFloat((Math.random() * 1000 + 200).toFixed(2))
    );
  }
  return { labels, data };
};

/**
 * Gera dados fictícios de consumo por categoria
 * Simula distribuição típica de consumo residencial
 * 
 * @returns {Object} Dados formatados para gráfico de pizza
 */
const generateMockConsumptionByType = () => {
  return {
    labels: [
      "Iluminação",
      "Refrigeração", 
      "Aquecimento",
      "Entretenimento",
      "Outros",
    ],
    data: [25, 30, 15, 20, 10], // Percentuais realistas
    backgroundColor: [
      "rgba(255, 99, 132, 0.7)",
      "rgba(54, 162, 235, 0.7)",
      "rgba(255, 206, 86, 0.7)",
      "rgba(75, 192, 192, 0.7)",
      "rgba(153, 102, 255, 0.7)",
    ],
    hoverOffset: 4,
  };
};

// === CONTROLLER PRINCIPAL ===

/**
 * Obtém todos os dados consolidados do dashboard
 * 
 * Função principal que retorna métricas, gráficos e dados de dispositivos.
 * Implementa lógica dual: dados reais para admins, dados fictícios para usuários.
 * 
 * @param {Object} req - Request object com dados do usuário autenticado
 * @param {Object} res - Response object para retorno dos dados
 */
async function getDashboardData(req, res) {
  const userId = req.user.userId;
  const userEmail = req.user.email;
  const isAdmin = req.user.isAdmin; // 'isAdmin' já vem do middleware authenticateToken

  let dashboardData = {};

  try {
    if (isAdmin) {
      // Cache para evitar log repetitivo de admin user
      const adminLogKey = `admin_${userId}`;
      const lastAdminLog = adminUserLogCache.get(adminLogKey);
      const timeSinceLastLog = lastAdminLog
        ? Date.now() - lastAdminLog.timestamp
        : Infinity;

      // Só loga se passou mais de 5 minutos desde o último log
      if (!lastAdminLog || timeSinceLastLog > 300000) {
        // 5 minutos
        console.log(`Admin user ${userEmail} accessing real data.`);
        adminUserLogCache.set(adminLogKey, { timestamp: Date.now() });
      }

      // 1. Buscar os dispositivos do usuário (com a última leitura de energia incluída)
      const userDevices = await prisma.device.findMany({
        where: { userId: userId },
        include: {
          readings: {
            where: { power: { gt: 0 } }, // Filtra apenas leituras reais
            orderBy: { timestamp: "desc" },
            take: 1, // Pega apenas a última leitura real
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
        "#FF6384",
        "#36A2EB",
        "#FFCE56",
        "#4BC0C0",
        "#9966FF",
        "#FF9F40",
        "#8D6E63",
        "#26A69A",
      ];

      // Para o gráfico principal (consumo diário nos últimos 7 dias)
      const mainChartLabels = [];
      const mainChartDataValues = Array(7).fill(0); // Inicializa com 0 para 7 dias
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zera hora para comparação de dia

      for (let i = 6; i >= 0; i--) {
        // Últimos 7 dias, incluindo hoje
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        mainChartLabels.push(
          d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        ); // Ex: 26/06
      }

      // --- Processar cada dispositivo para coletar dados ---
      for (const device of userDevices) {
        const latestReading =
          device.readings.length > 0 ? device.readings[0] : null;

        // Só loga se há mudança significativa nos dados
        if (
          latestReading &&
          hasSignificantChange(device.id, latestReading, device.powerState)
        ) {
          console.log(
            "Leitura enviada para o frontend:",
            JSON.stringify(latestReading, null, 2)
          );
        } else if (
          latestReading &&
          !device.powerState &&
          latestReading.power === 0
        ) {
          // Log único para dispositivos desligados (só uma vez por sessão)
          const deviceOffKey = `${device.id}_off_logged`;
          if (!lastLoggedData.has(deviceOffKey)) {
            console.log(
              `Dispositivo ${device.name} está desligado - dados zerados (não serão mais logados até mudança significativa)`
            );
            lastLoggedData.set(deviceOffKey, { timestamp: Date.now() });
          }
        }

        realDevicesData.push({
          id: device.id,
          name: device.name,
          tasmotaTopic: device.tasmotaTopic,
          macAddress: device.macAddress,
          model: device.model,
          powerState: device.powerState, // PowerState vem do modelo Device
          latestReading: latestReading
            ? {
                power: latestReading.power, // W
                voltage: latestReading.voltage, // V
                current: latestReading.current, // A
                totalEnergy: latestReading.totalEnergy, // kWh
                EnergyToday: latestReading.EnergyToday,
                EnergyYesterday: latestReading.EnergyYesterday,
                ApparentPower: latestReading.ApparentPower,
                ReactivePower: latestReading.ReactivePower,
                PowerFactor: latestReading.PowerFactor,
                timestamp: latestReading.timestamp,
              }
            : null,
        });

        if (latestReading) {
          currentRealPower += latestReading.power; // Soma a potência instantânea
          totalConsumptionAccumulated += latestReading.totalEnergy; // Soma o total acumulado do medidor

          // Acumular consumo para o gráfico de pizza (por tipo de dispositivo/nome)
          if (latestReading.totalEnergy > 0) {
            const deviceTypeName = device.model || "Outros"; // Usa o modelo do dispositivo para tipagem
            energyConsumptionByDeviceType[deviceTypeName] =
              (energyConsumptionByDeviceType[deviceTypeName] || 0) +
              latestReading.totalEnergy;
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

        const monthReadings = await prisma.energyReading.findMany({
          where: {
            deviceId: device.id,
            timestamp: {
              gte: startOfMonth,
              lte: today, // Até o dia atual
            },
          },
          orderBy: { timestamp: "asc" }, // Ordena para calcular o diff
        });

        // Calcula o consumo mensal para este dispositivo (diferença do totalEnergy)
        if (monthReadings.length > 1) {
          const firstReadingMonth = monthReadings[0].totalEnergy;
          const lastReadingMonth =
            monthReadings[monthReadings.length - 1].totalEnergy;
          currentMonthConsumption += lastReadingMonth - firstReadingMonth;
        } else if (monthReadings.length === 1 && monthReadings[0].totalEnergy) {
          // Se só tiver uma leitura no mês, considera o valor como consumo
          // Ou, se o Tasmota reiniciar, o totalEnergy pode ser menor que o anterior.
          // Uma abordagem robusta seria salvar a diferença ou o consumo por intervalo.
          // Para TCC, vamos somar o totalEnergy se for a única leitura,
          // ou a diferença se houver mais de uma.
          currentMonthConsumption += monthReadings[0].totalEnergy;
        }

        // Calcula o consumo do último dia para este dispositivo
        // Simplificado: Soma de 'power' ou 'totalEnergy' dentro do último dia.
        // Uma maneira mais precisa seria: totalEnergy no final do dia - totalEnergy no início do dia.
        const lastDayReadings = await prisma.energyReading.findMany({
          where: {
            deviceId: device.id,
            timestamp: {
              gte: startOfLastDay,
              lt: endOfLastDay,
            },
          },
          orderBy: { timestamp: "asc" },
        });

        if (lastDayReadings.length > 1) {
          const firstReadingLastDay = lastDayReadings[0].totalEnergy;
          const lastReadingLastDay =
            lastDayReadings[lastDayReadings.length - 1].totalEnergy;
          dailyConsumptionLastDay += lastReadingLastDay - firstReadingLastDay;
        } else if (
          lastDayReadings.length === 1 &&
          lastDayReadings[0].totalEnergy
        ) {
          dailyConsumptionLastDay += lastDayReadings[0].totalEnergy;
        }

        // Processar dados históricos para o gráfico principal (consumo diário dos últimos 7 dias)
        // É mais eficiente fazer uma única query por dispositivo para os últimos 7 dias.
        const recentReadings = await prisma.energyReading.findMany({
          where: {
            deviceId: device.id,
            timestamp: {
              gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 dias atrás
              lte: today,
            },
          },
          orderBy: {
            timestamp: "asc", // Importante para calcular diferenças ou agregação
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
              const consumptionDiff =
                currentReading.totalEnergy - prevReading.totalEnergy;
              if (consumptionDiff > 0) {
                // Garante que a diferença é positiva
                const dateKey = currentDate.toISOString().split("T")[0]; // 'YYYY-MM-DD'
                dailyAggregatedConsumption[dateKey] =
                  (dailyAggregatedConsumption[dateKey] || 0) + consumptionDiff;
              }
            }
            prevReading = currentReading;
          }
        }

        // Mapeia os dados agregados para o array mainChartDataValues
        mainChartLabels.forEach((label, index) => {
          const dateForLabel = new Date(today);
          dateForLabel.setDate(today.getDate() - (6 - index));
          const dateKey = dateForLabel.toISOString().split("T")[0];
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
          currentMonthConsumption: parseFloat(
            currentMonthConsumption.toFixed(2)
          ),
          dailyConsumption: parseFloat(dailyConsumptionLastDay.toFixed(2)), // Consumo do último dia
          totalConsumption: parseFloat(totalConsumptionAccumulated.toFixed(2)), // Total acumulado de todos
          currentPower: parseFloat(currentRealPower.toFixed(2)), // Potência instantânea total em Watts
          devicesOnline: devicesActuallyOnline,
          energySaved: 0, // Lógica complexa, por enquanto 0
        },
        // O frontend espera 'labels' e 'datasets' para o gráfico principal
        mainChartData: {
          labels: mainChartLabels,
          datasets: [
            {
              label: "Consumo Diário (kWh)",
              data: mainChartDataValues.map((val) =>
                parseFloat(val.toFixed(2))
              ),
              borderColor: "#00bcd4", // Cores do seu frontend
              backgroundColor: "rgba(0, 188, 212, 0.4)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        // O frontend espera 'labels' e 'datasets' para o gráfico de pizza
        consumptionByTypeChartData: {
          labels: Object.keys(energyConsumptionByDeviceType),
          datasets: [
            {
              data: Object.values(energyConsumptionByDeviceType).map((val) =>
                parseFloat(val.toFixed(2))
              ),
              backgroundColor: consumptionByTypeColors.slice(
                0,
                Object.keys(energyConsumptionByDeviceType).length
              ),
              borderColor: consumptionByTypeColors
                .slice(0, Object.keys(energyConsumptionByDeviceType).length)
                .map((color) => color.replace("0.7", "1")), // Torna a borda mais opaca
              borderWidth: 1,
            },
          ],
        },
        deviceSuggestions: [], // As sugestões virão do frontend ou de uma lógica mais avançada
        // A lista de controle do dispositivo já está dentro de userDevices para o frontend
        // deviceControlList: realDevicesData, // Removido, userDevices já inclui isso
        reports: {
          summary: `Relatório de consumo real para o usuário ${userEmail}.`,
          deviceReports: realDevicesData.map((d) => ({
            id: d.id,
            name: d.name,
            status: d.powerState ? "LIGADO" : "DESLIGADO",
            lastReport: d.latestReading
              ? `Potência: ${d.latestReading.power}W, Total Acumulado: ${d.latestReading.totalEnergy} kWh`
              : "Sem dados",
            impact:
              d.latestReading && d.latestReading.power > 100
                ? "Alto Consumo"
                : "Consumo Normal",
          })),
        },
      };

      // Remova toda a lógica relacionada a whatsappNumber (salvar, atualizar, retornar, etc).
    } else {
      console.log(`Non-admin user ${userEmail} accessing fictional data.`);
      // Retornar dados fictícios para usuários não-admin

      // NOVO: mockDailyConsumption para o frontend
      const mockDailyConsumptionData = [3.2, 3.5, 2.9, 4.1, 3.8, 4.5, 3.9]; // kWh fictício diário
      const mockDailyConsumptionLabels = [
        "Seg",
        "Ter",
        "Qua",
        "Qui",
        "Sex",
        "Sáb",
        "Dom",
      ];

      dashboardData = {
        isRealData: false,
        userEmail: userEmail,
        userDevices: mockDevices.map((d) => ({
          // Renomeado para userDevices para consistência
          ...d,
          latestReading: {
            // Mock de latestReading para o frontend
            power: d.power,
            totalEnergy: d.totalEnergy,
            timestamp: new Date().toISOString(),
          },
        })),
        metrics: {
          currentMonthConsumption: parseFloat(
            (Math.random() * 200 + 50).toFixed(2)
          ), // kWh
          dailyConsumption: parseFloat((Math.random() * 5 + 1).toFixed(2)), // kWh do último dia
          totalConsumption: parseFloat((Math.random() * 1500 + 500).toFixed(2)), // kWh acumulado
          currentPower: parseFloat((Math.random() * 500 + 50).toFixed(2)), // Watts
          devicesOnline: mockDevices.filter((d) => d.powerState).length,
          energySaved: parseFloat((Math.random() * 10 + 1).toFixed(2)),
        },
        mainChartData: {
          // Usa mockDailyConsumptionLabels/Data
          labels: mockDailyConsumptionLabels,
          datasets: [
            {
              label: "Consumo Diário (kWh)",
              data: mockDailyConsumptionData,
              borderColor: "#00bcd4",
              backgroundColor: "rgba(0, 188, 212, 0.4)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        consumptionByTypeChartData: generateMockConsumptionByType(), // Já adaptado
        deviceSuggestions: [
          "Trocar lâmpadas por LED",
          "Desligar aparelhos em standby",
          "Aproveitar a luz natural",
        ],
        reports: {
          summary:
            "Este é um relatório fictício para demonstração. Faça login como administrador para ver dados reais.",
          deviceReports: mockDevices.map((d) => ({
            id: d.id,
            name: d.name,
            status: d.powerState ? "LIGADO" : "DESLIGADO",
            lastReport: `Potência: ${d.power}W, Total Acumulado: ${d.totalEnergy} Wh (fictício)`,
            impact:
              d.power > 100 || d.totalEnergy > 2000
                ? "Alto Consumo (Fictício)"
                : "Consumo Normal (Fictício)",
          })),
        },
      };
    }

    // console.log('Dados enviados para o frontend:', JSON.stringify(dashboardData, null, 2));
    res.json(dashboardData);
  } catch (error) {
    console.error("Erro ao carregar dados do dashboard:", error);
    res.status(500).json({
      message: "Erro interno do servidor ao carregar dados do dashboard.",
    });
  }
}

// Atualiza o número do WhatsApp do usuário logado
async function updateWhatsappNumber(req, res) {
  const userId = req.user.userId;
  const { whatsappNumber } = req.body;
  // Validação simples: só aceita número com 13 dígitos (ex: 5562999999999)
  if (!/^\d{13}$/.test(whatsappNumber)) {
    return res
      .status(400)
      .json({ error: "Formato inválido. Exemplo: 5562999999999" });
  }
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { whatsappNumber },
    });
    return res.json({ success: true });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Erro ao atualizar número do WhatsApp." });
  }
}

module.exports = {
  getDashboardData,
  updateWhatsappNumber,
};
