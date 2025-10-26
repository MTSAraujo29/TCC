// backend/services/energyTotalManager.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ==============================================
// Utility Functions
// ==============================================

/**
 * Verifica se hoje é o último dia do mês
 * @returns {boolean}
 */
function isLastDayOfMonth() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return today.getDate() === lastDay.getDate();
}

/**
 * Verifica se hoje é o penúltimo dia do mês
 * @returns {boolean}
 */
function isPenultimateDayOfMonth() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return today.getDate() === lastDay.getDate() - 1;
}

/**
 * Verifica se é o último minuto do último dia do mês (23:59)
 * @returns {boolean}
 */
function isLastMinuteOfMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return (
    now.getDate() === lastDay.getDate() &&
    now.getHours() === 23 &&
    now.getMinutes() === 59
  );
}

/**
 * Verifica se é o último dia do mês (mais flexível que isLastMinuteOfMonth)
 * @returns {boolean}
 */
function isLastDayOfMonthFlexible() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return now.getDate() === lastDay.getDate();
}

/**
 * Calcula o consumo mensal de energia total
 * @param {number} currentTotalEnergy - Valor atual do totalEnergy do Tasmota
 * @param {number} lastSavedTotalEnergy - Último valor salvo no banco
 * @returns {number} Consumo mensal calculado
 */
function calculateMonthlyConsumption(currentTotalEnergy, lastSavedTotalEnergy) {
  if (!lastSavedTotalEnergy || lastSavedTotalEnergy === 0) {
    return currentTotalEnergy;
  }

  const monthlyConsumption = currentTotalEnergy - lastSavedTotalEnergy;

  if (monthlyConsumption < 0) {
    console.log(
      `Valor negativo detectado: ${monthlyConsumption}. Possível reset do Tasmota. Retornando valor atual: ${currentTotalEnergy}`
    );
    return currentTotalEnergy;
  }

  return monthlyConsumption;
}

// ==============================================
// Core Processing Functions
// ==============================================

/**
 * Processa dados de energia com lógica especial para totalEnergy
 * @param {Object} energyData - Dados de energia do Tasmota
 * @param {string} deviceId - ID do dispositivo
 * @param {string} tasmotaTopic - Tópico do dispositivo
 * @param {string} brokerLabel - Label do broker (broker1 ou broker2)
 * @returns {Object} Dados processados para salvar no banco
 */
async function processEnergyData(
  energyData,
  deviceId,
  tasmotaTopic,
  brokerLabel
) {
  const device = await getDevice(deviceId);
  const dataToSave = prepareBaseData(
    energyData,
    deviceId,
    energyData.timestamp
  );

  // Log de debug para verificar condições
  const now = new Date();
  const isLastDay = isLastDayOfMonth();
  const isLastMinute = isLastMinuteOfMonth();
  const isLastDayFlexible = isLastDayOfMonthFlexible();

  console.log(
    `[${tasmotaTopic}] [${brokerLabel}] Verificando condições de salvamento:`,
    {
      currentTime: now.toISOString(),
      isLastDay,
      isLastMinute,
      isLastDayFlexible,
      deviceId,
      totalEnergy: energyData.totalEnergy,
      brokerLabel,
    }
  );

  // Verifica se é o último dia do mês
  if (isLastDayFlexible) {
    // Verifica se já foi salva a primeira leitura deste broker neste último dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Busca se já existe uma leitura com totalEnergy deste broker hoje
    const existingReading = await prisma.energyReading.findFirst({
      where: {
        deviceId: deviceId,
        brokerLabel: brokerLabel,
        totalEnergy: { not: null },
        timestamp: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (!existingReading) {
      // PRIMEIRA LEITURA do broker no último dia do mês - SALVA
      const lastMonthTotal = device.lastSavedTotalEnergy || 0;
      const monthlyConsumption = calculateMonthlyConsumption(
        energyData.totalEnergy,
        lastMonthTotal
      );
      dataToSave.totalEnergy = monthlyConsumption;

      // Atualiza o valor salvo no dispositivo
      await prisma.device.update({
        where: { id: deviceId },
        data: { lastSavedTotalEnergy: energyData.totalEnergy },
      });

      // SALVA NO NOVO MODELO KWHMonthly
      const now = new Date();
      const month = now.getMonth() + 1; // getMonth() retorna 0-11, queremos 1-12
      const year = now.getFullYear();

      // Busca o último registro mensal deste broker para este dispositivo
      const lastMonthlyRecord = await prisma.kWHMonthly.findFirst({
        where: {
          deviceId: deviceId,
          brokerLabel: brokerLabel,
        },
        orderBy: { createdAt: "desc" },
      });

      // Calcula o consumo mensal real (diferença)
      let realMonthlyConsumption = monthlyConsumption;
      if (lastMonthlyRecord) {
        realMonthlyConsumption =
          energyData.totalEnergy - lastMonthlyRecord.totalEnergyAccumulated;
        if (realMonthlyConsumption < 0) {
          // Se o valor for negativo, pode ser reset do Tasmota, usa o valor atual
          realMonthlyConsumption = energyData.totalEnergy;
        }
      }

      // Salva no KWHMonthly
      await prisma.kWHMonthly.create({
        data: {
          deviceId: deviceId,
          userId: device.userId,
          month: month,
          year: year,
          brokerLabel: brokerLabel,
          totalEnergyAccumulated: energyData.totalEnergy,
          monthlyConsumption: realMonthlyConsumption,
          timestamp: now,
        },
      });

      console.log(
        `[${tasmotaTopic}] [${brokerLabel}] ✅ PRIMEIRA LEITURA DO ÚLTIMO DIA - Consumo mensal calculado: ${monthlyConsumption} kWh (Total acumulado: ${energyData.totalEnergy} kWh)`
      );
      console.log(
        `[${tasmotaTopic}] [${brokerLabel}] 💾 SALVO NO KWHMonthly - Consumo real do mês: ${realMonthlyConsumption} kWh`
      );
    } else {
      // JÁ FOI SALVA a primeira leitura deste broker hoje - NÃO SALVA
      dataToSave.totalEnergy = null;
      console.log(
        `[${tasmotaTopic}] [${brokerLabel}] ⏳ JÁ SALVA - Primeira leitura deste broker já foi salva hoje. TotalEnergy não será salvo novamente.`
      );
    }
  } else {
    // Não é o último dia do mês - NÃO SALVA totalEnergy
    dataToSave.totalEnergy = null;
    console.log(
      `[${tasmotaTopic}] [${brokerLabel}] ⏳ Não é o último dia do mês - totalEnergy não será salvo`
    );
  }

  // Sempre retorna o objeto completo para ser salvo no banco
  return dataToSave;
}

// ==============================================
// Helper Functions
// ==============================================

async function getDevice(deviceId) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error(`Dispositivo não encontrado: ${deviceId}`);
  }
  return device;
}

function prepareBaseData(energyData, deviceId, timestamp) {
  // Converte o timestamp para o horário de Brasília (America/Sao_Paulo)
  let dateBrasilia;
  if (timestamp) {
    // Se já veio um timestamp, converte para string local e cria novo Date
    dateBrasilia = new Date(
      new Date(timestamp).toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
      })
    );
  } else {
    // Se não veio, pega o momento atual em Brasília
    dateBrasilia = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
    );
  }
  return {
    deviceId,
    timestamp: dateBrasilia,
    power: energyData.power,
    voltage: energyData.voltage,
    current: energyData.current,
    EnergyToday: energyData.EnergyToday,
    EnergyYesterday: energyData.EnergyYesterday,
    ApparentPower: energyData.ApparentPower,
    ReactivePower: energyData.ReactivePower,
    PowerFactor: energyData.PowerFactor,
  };
}

// ==============================================
// Data Retrieval Functions
// ==============================================

/**
 * Obtém o valor atual de energia total para exibição no frontend
 * @param {string} deviceId - ID do dispositivo
 * @returns {Promise<number|null>} Valor atual de energia total ou null se não disponível
 */
async function getCurrentTotalEnergyForDisplay(deviceId) {
  try {
    const lastReadingWithTotal = await prisma.energyReading.findFirst({
      where: {
        deviceId,
        totalEnergy: { not: null },
      },
      orderBy: { timestamp: "desc" },
    });

    if (lastReadingWithTotal) {
      return lastReadingWithTotal.totalEnergy;
    }

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    return (device && device.lastSavedTotalEnergy) || null;
  } catch (error) {
    console.error("Erro ao obter energia total para exibição:", error);
    return null;
  }
}

/**
 * Obtém o valor acumulado real do Tasmota para exibição
 * @param {string} deviceId - ID do dispositivo
 * @returns {Promise<number|null>} Valor acumulado atual do Tasmota
 */
async function getAccumulatedTotalEnergy(deviceId) {
  try {
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
    });

    return (device && device.lastSavedTotalEnergy) || null;
  } catch (error) {
    console.error("Erro ao obter energia total acumulada:", error);
    return null;
  }
}

// ==============================================
// Test Functions
// ==============================================

/**
 * Função de teste para verificar se a lógica de detecção do último dia está funcionando
 * @returns {Object} Status das funções de detecção
 */
function testLastDayDetection() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  console.log("=== TESTE DE DETECÇÃO DO ÚLTIMO DIA DO MÊS ===");
  console.log("Data atual:", now.toISOString());
  console.log("Último dia do mês:", lastDay.getDate());
  console.log("Dia atual:", now.getDate());
  console.log("Hora atual:", now.getHours());
  console.log("Minuto atual:", now.getMinutes());
  console.log("isLastDayOfMonth():", isLastDayOfMonth());
  console.log("isLastDayOfMonthFlexible():", isLastDayOfMonthFlexible());
  console.log("isLastMinuteOfMonth():", isLastMinuteOfMonth());
  console.log("isPenultimateDayOfMonth():", isPenultimateDayOfMonth());
  console.log("===============================================");

  return {
    currentDate: now.toISOString(),
    lastDayOfMonth: lastDay.getDate(),
    currentDay: now.getDate(),
    currentHour: now.getHours(),
    currentMinute: now.getMinutes(),
    isLastDay: isLastDayOfMonth(),
    isLastDayFlexible: isLastDayOfMonthFlexible(),
    isLastMinute: isLastMinuteOfMonth(),
    isPenultimate: isPenultimateDayOfMonth(),
  };
}

/**
 * Verifica o status de salvamento por broker no último dia do mês
 * @param {string} deviceId - ID do dispositivo
 * @returns {Object} Status de salvamento por broker
 */
async function checkBrokerSaveStatus(deviceId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Busca leituras com totalEnergy não nulo de hoje
    const readings = await prisma.energyReading.findMany({
      where: {
        deviceId: deviceId,
        totalEnergy: { not: null },
        timestamp: {
          gte: today,
          lt: tomorrow,
        },
      },
      select: {
        brokerLabel: true,
        totalEnergy: true,
        timestamp: true,
      },
      orderBy: { timestamp: "asc" },
    });

    const brokerStatus = {
      broker1: {
        saved: false,
        timestamp: null,
        totalEnergy: null,
      },
      broker2: {
        saved: false,
        timestamp: null,
        totalEnergy: null,
      },
    };

    readings.forEach((reading) => {
      if (reading.brokerLabel === "broker1") {
        brokerStatus.broker1.saved = true;
        brokerStatus.broker1.timestamp = reading.timestamp;
        brokerStatus.broker1.totalEnergy = reading.totalEnergy;
      } else if (reading.brokerLabel === "broker2") {
        brokerStatus.broker2.saved = true;
        brokerStatus.broker2.timestamp = reading.timestamp;
        brokerStatus.broker2.totalEnergy = reading.totalEnergy;
      }
    });

    console.log(`[${deviceId}] Status de salvamento por broker:`, brokerStatus);
    return brokerStatus;
  } catch (error) {
    console.error("Erro ao verificar status de salvamento por broker:", error);
    return null;
  }
}

/**
 * Obtém o consumo mensal total de todos os dispositivos do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<number>} Consumo mensal total em kWh
 */
async function getTotalMonthlyConsumption(userId) {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Busca todos os registros mensais do usuário para o mês atual
    const monthlyRecords = await prisma.kWHMonthly.findMany({
      where: {
        userId: userId,
        month: currentMonth,
        year: currentYear,
      },
      select: {
        monthlyConsumption: true,
        brokerLabel: true,
      },
    });

    // Soma o consumo de todos os brokers
    const totalConsumption = monthlyRecords.reduce((sum, record) => {
      return sum + (record.monthlyConsumption || 0);
    }, 0);

    console.log(
      `[${userId}] Consumo mensal total calculado: ${totalConsumption} kWh`
    );
    return parseFloat(totalConsumption.toFixed(2));
  } catch (error) {
    console.error("Erro ao obter consumo mensal total:", error);
    return 0;
  }
}

/**
 * Obtém dados mensais para gráfico (últimos 12 meses)
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Dados para gráfico mensal
 */
async function getMonthlyChartData(userId) {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Busca dados dos últimos 12 meses
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const targetDate = new Date(currentYear, currentMonth - 1 - i, 1);
      const month = targetDate.getMonth() + 1;
      const year = targetDate.getFullYear();

      const records = await prisma.kWHMonthly.findMany({
        where: {
          userId: userId,
          month: month,
          year: year,
        },
        select: {
          monthlyConsumption: true,
          brokerLabel: true,
        },
      });

      // Soma o consumo de todos os brokers para este mês
      const monthTotal = records.reduce((sum, record) => {
        return sum + (record.monthlyConsumption || 0);
      }, 0);

      monthlyData.push({
        month: month,
        year: year,
        consumption: parseFloat(monthTotal.toFixed(2)),
        label: targetDate.toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        }),
      });
    }

    return {
      labels: monthlyData.map((d) => d.label),
      data: monthlyData.map((d) => d.consumption),
    };
  } catch (error) {
    console.error("Erro ao obter dados do gráfico mensal:", error);
    return {
      labels: [],
      data: [],
    };
  }
}

/**
 * Calcula a fatura estimada baseada na tarifa da Equatorial Goiás
 * @param {number} consumption - Consumo em kWh
 * @param {number} month - Mês (1-12)
 * @param {number} year - Ano
 * @returns {Object} Cálculo da fatura
 */
function calculateEstimatedBill(consumption, month, year) {
  try {
    // Tarifa base da Equatorial Goiás (após reajuste de 19,56% em outubro de 2025)
    const baseTariff = 0.89181 * 1.1956; // R$ 1,06611 por kWh

    // Bandeira tarifária (outubro 2025 - Vermelha Patamar 1)
    // Para simplificar, vamos usar a bandeira atual
    const tariffFlag = 0.04463; // R$ 0,04463 por kWh (Vermelha Patamar 1)

    // Custo total por kWh
    const totalCostPerKwh = baseTariff + tariffFlag; // R$ 1,11074 por kWh

    // Cálculo da fatura
    const estimatedBill = consumption * totalCostPerKwh;

    console.log(`💰 Cálculo da fatura estimada:`, {
      consumption: `${consumption} kWh`,
      baseTariff: `R$ ${baseTariff.toFixed(5)}/kWh`,
      tariffFlag: `R$ ${tariffFlag.toFixed(5)}/kWh`,
      totalCostPerKwh: `R$ ${totalCostPerKwh.toFixed(5)}/kWh`,
      estimatedBill: `R$ ${estimatedBill.toFixed(2)}`,
    });

    return {
      consumption: consumption,
      baseTariff: parseFloat(baseTariff.toFixed(5)),
      tariffFlag: parseFloat(tariffFlag.toFixed(5)),
      totalCostPerKwh: parseFloat(totalCostPerKwh.toFixed(5)),
      estimatedBill: parseFloat(estimatedBill.toFixed(2)),
      details: {
        baseTariffFormatted: `R$ ${baseTariff.toFixed(5)}/kWh`,
        tariffFlagFormatted: `R$ ${tariffFlag.toFixed(5)}/kWh`,
        totalCostFormatted: `R$ ${totalCostPerKwh.toFixed(5)}/kWh`,
        estimatedBillFormatted: `R$ ${estimatedBill.toFixed(2)}`,
      },
    };
  } catch (error) {
    console.error("Erro ao calcular fatura estimada:", error);
    return {
      consumption: consumption,
      estimatedBill: 0,
      error: error.message,
    };
  }
}

/**
 * Obtém a fatura estimada do último mês com dados no KWHMonthly
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Fatura estimada
 */
async function getEstimatedBill(userId) {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Busca o último registro mensal do usuário
    const lastMonthlyRecord = await prisma.kWHMonthly.findFirst({
      where: {
        userId: userId,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
    });

    if (!lastMonthlyRecord) {
      console.log(
        `[${userId}] Nenhum registro mensal encontrado para cálculo da fatura`
      );
      return {
        estimatedBill: 0,
        consumption: 0,
        month: currentMonth,
        year: currentYear,
        hasData: false,
      };
    }

    // Busca todos os registros do mesmo mês/ano para somar o consumo total
    const monthlyRecords = await prisma.kWHMonthly.findMany({
      where: {
        userId: userId,
        month: lastMonthlyRecord.month,
        year: lastMonthlyRecord.year,
      },
      select: {
        monthlyConsumption: true,
        brokerLabel: true,
      },
    });

    // Soma o consumo de todos os brokers para este mês
    const totalConsumption = monthlyRecords.reduce((sum, record) => {
      return sum + (record.monthlyConsumption || 0);
    }, 0);

    // Calcula a fatura estimada
    const billCalculation = calculateEstimatedBill(
      totalConsumption,
      lastMonthlyRecord.month,
      lastMonthlyRecord.year
    );

    console.log(`[${userId}] Fatura estimada calculada:`, {
      month: lastMonthlyRecord.month,
      year: lastMonthlyRecord.year,
      totalConsumption: `${totalConsumption} kWh`,
      estimatedBill: `R$ ${billCalculation.estimatedBill}`,
    });

    return {
      estimatedBill: billCalculation.estimatedBill,
      consumption: totalConsumption,
      month: lastMonthlyRecord.month,
      year: lastMonthlyRecord.year,
      hasData: true,
      calculation: billCalculation,
    };
  } catch (error) {
    console.error("Erro ao obter fatura estimada:", error);
    return {
      estimatedBill: 0,
      consumption: 0,
      month: currentMonth,
      year: currentYear,
      hasData: false,
      error: error.message,
    };
  }
}

/**
 * Calcula a redução de CO2 baseada na economia de energia
 * @param {number} energySaved - Economia de energia em kWh
 * @returns {Object} Cálculo da redução de CO2
 */
function calculateCO2Reduction(energySaved) {
  try {
    // Fator de emissão médio do Brasil (Sistema Interligado Nacional)
    // Fonte: Ministério de Minas e Energia (MME)
    const emissionFactor = 0.0736; // kg CO2/kWh

    // Cálculo da redução de CO2
    const co2Reduction = energySaved * emissionFactor;

    console.log(`🌱 Cálculo da redução de CO2:`, {
      energySaved: `${energySaved} kWh`,
      emissionFactor: `${emissionFactor} kg CO2/kWh`,
      co2Reduction: `${co2Reduction.toFixed(4)} kg CO2`,
      co2ReductionGrams: `${(co2Reduction * 1000).toFixed(1)} g CO2`,
    });

    return {
      energySaved: energySaved,
      emissionFactor: emissionFactor,
      co2Reduction: parseFloat(co2Reduction.toFixed(4)),
      co2ReductionGrams: parseFloat((co2Reduction * 1000).toFixed(1)),
      details: {
        energySavedFormatted: `${energySaved} kWh`,
        emissionFactorFormatted: `${emissionFactor} kg CO2/kWh`,
        co2ReductionFormatted: `${co2Reduction.toFixed(4)} kg CO2`,
        co2ReductionGramsFormatted: `${(co2Reduction * 1000).toFixed(1)} g CO2`,
      },
    };
  } catch (error) {
    console.error("Erro ao calcular redução de CO2:", error);
    return {
      energySaved: energySaved,
      co2Reduction: 0,
      error: error.message,
    };
  }
}

/**
 * Obtém a economia mensal e redução de CO2 comparando com o mês anterior
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Economia mensal e redução de CO2
 */
async function getMonthlySavings(userId) {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Busca os dois últimos registros mensais do usuário
    const monthlyRecords = await prisma.kWHMonthly.findMany({
      where: {
        userId: userId,
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      take: 2,
    });

    if (monthlyRecords.length < 2) {
      console.log(
        `[${userId}] Dados insuficientes para calcular economia mensal`
      );
      return {
        energySaved: 0,
        co2Reduction: 0,
        currentMonth: currentMonth,
        currentYear: currentYear,
        hasData: false,
      };
    }

    // Busca todos os registros do mês atual
    const currentMonthRecords = await prisma.kWHMonthly.findMany({
      where: {
        userId: userId,
        month: monthlyRecords[0].month,
        year: monthlyRecords[0].year,
      },
      select: {
        monthlyConsumption: true,
        brokerLabel: true,
      },
    });

    // Busca todos os registros do mês anterior
    const previousMonthRecords = await prisma.kWHMonthly.findMany({
      where: {
        userId: userId,
        month: monthlyRecords[1].month,
        year: monthlyRecords[1].year,
      },
      select: {
        monthlyConsumption: true,
        brokerLabel: true,
      },
    });

    // Soma o consumo do mês atual
    const currentMonthConsumption = currentMonthRecords.reduce(
      (sum, record) => {
        return sum + (record.monthlyConsumption || 0);
      },
      0
    );

    // Soma o consumo do mês anterior
    const previousMonthConsumption = previousMonthRecords.reduce(
      (sum, record) => {
        return sum + (record.monthlyConsumption || 0);
      },
      0
    );

    // Calcula a economia (diferença positiva = economia)
    const energySaved = Math.max(
      0,
      previousMonthConsumption - currentMonthConsumption
    );

    // Calcula a redução de CO2
    const co2Calculation = calculateCO2Reduction(energySaved);

    console.log(`[${userId}] Economia mensal calculada:`, {
      currentMonth: `${monthlyRecords[0].month}/${monthlyRecords[0].year}`,
      previousMonth: `${monthlyRecords[1].month}/${monthlyRecords[1].year}`,
      currentConsumption: `${currentMonthConsumption} kWh`,
      previousConsumption: `${previousMonthConsumption} kWh`,
      energySaved: `${energySaved} kWh`,
      co2Reduction: `${co2Calculation.co2Reduction} kg CO2`,
    });

    return {
      energySaved: energySaved,
      co2Reduction: co2Calculation.co2Reduction,
      co2ReductionGrams: co2Calculation.co2ReductionGrams,
      currentMonth: monthlyRecords[0].month,
      currentYear: monthlyRecords[0].year,
      previousMonth: monthlyRecords[1].month,
      previousYear: monthlyRecords[1].year,
      currentConsumption: currentMonthConsumption,
      previousConsumption: previousMonthConsumption,
      hasData: true,
      calculation: co2Calculation,
    };
  } catch (error) {
    console.error("Erro ao obter economia mensal:", error);
    return {
      energySaved: 0,
      co2Reduction: 0,
      currentMonth: currentMonth,
      currentYear: currentYear,
      hasData: false,
      error: error.message,
    };
  }
}

// ==============================================
// Module Exports
// ==============================================

module.exports = {
  isLastDayOfMonth,
  isPenultimateDayOfMonth,
  isLastMinuteOfMonth,
  isLastDayOfMonthFlexible,
  calculateMonthlyConsumption,
  processEnergyData,
  getCurrentTotalEnergyForDisplay,
  getAccumulatedTotalEnergy,
  testLastDayDetection,
  checkBrokerSaveStatus,
  getTotalMonthlyConsumption,
  getMonthlyChartData,
  calculateEstimatedBill,
  getEstimatedBill,
  calculateCO2Reduction,
  getMonthlySavings,
};
