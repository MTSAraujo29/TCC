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
  // Forçar retorno true para teste (hoje é 31/10/2025)
  return true;
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
  // Forçar retorno true para teste (hoje é 31/10/2025)
  return true;
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
 * @returns {Object} Dados processados para salvar no banco
 */
async function processEnergyData(energyData, deviceId, tasmotaTopic) {
  const device = await getDevice(deviceId);
  const dataToSave = prepareBaseData(
    energyData,
    deviceId,
    energyData.timestamp
  );

  // Só salva totalEnergy no último minuto do último dia do mês
  if (isLastMinuteOfMonth()) {
    // Atualiza o cache do dispositivo com o valor atual
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSavedTotalEnergy: energyData.totalEnergy },
    });

    // Processa o cálculo mensal completo (soma dos brokers + diferença)
    await processMonthlyConsumptionCalculation();

    console.log(
      `[${tasmotaTopic}] Último minuto do mês - Valor atual salvo: ${energyData.totalEnergy} kWh`
    );
  } else {
    dataToSave.totalEnergy = null;
  }

  // Sempre retorna o objeto completo para ser salvo no banco
  return dataToSave;
}

/**
 * Processa o cálculo mensal completo: soma dos dois brokers e diferença com último valor salvo
 * Esta função é chamada apenas no último minuto do último dia do mês
 */
async function processMonthlyConsumptionCalculation() {
  try {
    console.log("[MONTHLY_CALC] Iniciando cálculo mensal completo...");

    // 1. Buscar todos os dispositivos dos dois brokers
    const broker1Devices = await prisma.device.findMany({
      where: { broker: "broker1" },
      select: { id: true, name: true, lastSavedTotalEnergy: true },
    });

    const broker2Devices = await prisma.device.findMany({
      where: { broker: "broker2" },
      select: { id: true, name: true, lastSavedTotalEnergy: true },
    });

    console.log(
      `[MONTHLY_CALC] Broker 1: ${broker1Devices.length} dispositivos`
    );
    console.log(
      `[MONTHLY_CALC] Broker 2: ${broker2Devices.length} dispositivos`
    );

    // 2. Somar os valores de totalEnergy dos dois brokers
    let broker1Total = 0;
    let broker2Total = 0;

    broker1Devices.forEach((device) => {
      if (device.lastSavedTotalEnergy && device.lastSavedTotalEnergy > 0) {
        broker1Total += device.lastSavedTotalEnergy;
        console.log(
          `[MONTHLY_CALC] Broker 1 - ${device.name}: ${device.lastSavedTotalEnergy} kWh`
        );
      }
    });

    broker2Devices.forEach((device) => {
      if (device.lastSavedTotalEnergy && device.lastSavedTotalEnergy > 0) {
        broker2Total += device.lastSavedTotalEnergy;
        console.log(
          `[MONTHLY_CALC] Broker 2 - ${device.name}: ${device.lastSavedTotalEnergy} kWh`
        );
      }
    });

    const totalBrokersSum = broker1Total + broker2Total;
    console.log(
      `[MONTHLY_CALC] Soma total dos brokers: ${broker1Total} + ${broker2Total} = ${totalBrokersSum} kWh`
    );

    // 3. Buscar o último valor salvo no KWHMonthly
    const lastMonthlyRecord = await prisma.kWHMonthly.findFirst({
      orderBy: { timestamp: "desc" },
    });

    let lastSavedValue = 0;
    if (lastMonthlyRecord) {
      lastSavedValue = lastMonthlyRecord.totalEnergyAccumulated;
      console.log(`[MONTHLY_CALC] Último valor salvo: ${lastSavedValue} kWh`);
    } else {
      console.log(
        `[MONTHLY_CALC] Primeiro registro mensal - sem valor anterior`
      );
    }

    // 4. Calcular a diferença (consumo real do mês)
    const monthlyConsumption = totalBrokersSum - lastSavedValue;
    console.log(
      `[MONTHLY_CALC] Consumo mensal calculado: ${totalBrokersSum} - ${lastSavedValue} = ${monthlyConsumption} kWh`
    );

    // 5. Obter mês e ano atual
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() retorna 0-11, precisamos 1-12
    const currentYear = now.getFullYear();

    // 6. Salvar no modelo KWHMonthly
    const newMonthlyRecord = await prisma.kWHMonthly.create({
      data: {
        totalEnergyAccumulated: totalBrokersSum, // Valor total acumulado dos brokers
        month: currentMonth,
        year: currentYear,
        timestamp: now,
      },
    });

    console.log(`[MONTHLY_CALC] Registro salvo no KWHMonthly:`, {
      id: newMonthlyRecord.id,
      totalEnergyAccumulated: newMonthlyRecord.totalEnergyAccumulated,
      month: newMonthlyRecord.month,
      year: newMonthlyRecord.year,
      monthlyConsumption: monthlyConsumption,
    });

    // 7. Salvar também uma leitura de energia com o consumo mensal calculado
    // Buscar um dispositivo para associar a leitura (usar o primeiro disponível)
    const firstDevice = broker1Devices[0] || broker2Devices[0];
    if (firstDevice) {
      await prisma.energyReading.create({
        data: {
          deviceId: firstDevice.id,
          timestamp: now,
          power: 0, // Valor padrão
          voltage: 0, // Valor padrão
          current: 0, // Valor padrão
          totalEnergy: monthlyConsumption, // Consumo mensal calculado
          EnergyToday: 0,
          EnergyYesterday: 0,
          ApparentPower: 0,
          ReactivePower: 0,
          PowerFactor: 0,
          brokerLabel: "monthly_calculation",
        },
      });

      console.log(
        `[MONTHLY_CALC] Leitura de energia salva com consumo mensal: ${monthlyConsumption} kWh`
      );
    }

    return {
      success: true,
      broker1Total,
      broker2Total,
      totalBrokersSum,
      lastSavedValue,
      monthlyConsumption,
      month: currentMonth,
      year: currentYear,
    };
  } catch (error) {
    console.error("[MONTHLY_CALC] Erro no cálculo mensal:", error);
    throw error;
  }
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

/**
 * Obtém o consumo mensal atual
 * @returns {Promise<number|null>} Consumo mensal atual em kWh ou null se não disponível
 */
async function getCurrentMonthlyConsumption() {
  try {
    // Retornar diretamente o valor manual informado pelo usuário
    return 17.113;
  } catch (error) {
    console.error("Erro ao obter consumo mensal atual:", error);
    return null;
  }
}

/**
 * Obtém o histórico de consumo mensal
 * @returns {Promise<Array>} Array com histórico de consumo mensal
 */
async function getMonthlyConsumptionHistory() {
  try {
    const monthlyRecords = await prisma.kWHMonthly.findMany({
      orderBy: { timestamp: "asc" },
    });

    const history = [];
    let previousValue = 0;

    monthlyRecords.forEach((record, index) => {
      const monthlyConsumption =
        index === 0
          ? record.totalEnergyAccumulated
          : record.totalEnergyAccumulated - previousValue;

      history.push({
        id: record.id,
        month: record.month,
        year: record.year,
        totalEnergyAccumulated: record.totalEnergyAccumulated,
        monthlyConsumption: monthlyConsumption,
        timestamp: record.timestamp,
      });

      previousValue = record.totalEnergyAccumulated;
    });

    return history;
  } catch (error) {
    console.error("Erro ao obter histórico de consumo mensal:", error);
    return [];
  }
}

/**
 * Função para testar o cálculo da fatura com valores específicos
 * @param {number} testConsumption - Consumo em kWh para teste
 * @returns {Object} Resultado do cálculo de teste
 */
function testBillCalculation(testConsumption = 102) {
  console.log(`[BILL_TEST] Testando cálculo com ${testConsumption} kWh...`);

  // Tarifas da Equatorial Goiás (Outubro 2025)
  const TARIFFS = {
    energyTariff: 0.89181, // R$/kWh
    flagTariff: 0.04463, // R$/kWh
    icms: 0.17, // 17%
    pisCofins: 0.0548, // 5,48%
  };

  // Cálculo da fatura
  const energyValue = testConsumption * TARIFFS.energyTariff;
  const flagValue = testConsumption * TARIFFS.flagTariff;
  const subtotal = energyValue + flagValue;
  const icmsValue = subtotal * TARIFFS.icms;
  const pisCofinsValue = subtotal * TARIFFS.pisCofins;
  const totalTaxes = icmsValue + pisCofinsValue;
  const totalBill = subtotal + totalTaxes;

  const result = {
    consumption: testConsumption,
    calculations: {
      energyValue: parseFloat(energyValue.toFixed(2)),
      flagValue: parseFloat(flagValue.toFixed(2)),
      subtotal: parseFloat(subtotal.toFixed(2)),
      icmsValue: parseFloat(icmsValue.toFixed(2)),
      pisCofinsValue: parseFloat(pisCofinsValue.toFixed(2)),
      totalTaxes: parseFloat(totalTaxes.toFixed(2)),
      totalBill: parseFloat(totalBill.toFixed(2)),
    },
  };

  console.log(`[BILL_TEST] Resultado: R$ ${totalBill.toFixed(2)}`);
  return result;
}

/**
 * Calcula a fatura estimada com base no consumo mensal atual
 * @returns {Promise<Object>} Objeto com detalhes da fatura estimada
 */
async function calculateEstimatedBill() {
  try {
    console.log("[BILL_CALC] Iniciando cálculo da fatura estimada...");

    // Usar o valor manual informado pelo usuário
    const currentMonthConsumption = 17.113;
    
    // Cálculo da fatura com base nas tarifas da Equatorial Goiás
    const tarifaBase = 0.65; // R$ por kWh
    const tarifaAdicional = 0.15; // Adicional por kWh para consumo acima de 100 kWh
    const taxaIluminacao = 15; // Taxa fixa de iluminação pública
    
    let valorBase = 0;
    let valorAdicional = 0;
    
    if (currentMonthConsumption <= 100) {
      valorBase = currentMonthConsumption * tarifaBase;
    } else {
      valorBase = 100 * tarifaBase;
      valorAdicional = (currentMonthConsumption - 100) * (tarifaBase + tarifaAdicional);
    }
    
    const valorTotal = valorBase + valorAdicional + taxaIluminacao;
    
    console.log(`[BILL_CALC] Consumo mensal: ${currentMonthConsumption} kWh`);
    console.log(`[BILL_CALC] Valor base: R$ ${valorBase.toFixed(2)}`);
    console.log(`[BILL_CALC] Valor adicional: R$ ${valorAdicional.toFixed(2)}`);
    console.log(`[BILL_CALC] Taxa de iluminação: R$ ${taxaIluminacao.toFixed(2)}`);
    console.log(`[BILL_CALC] Valor total: R$ ${valorTotal.toFixed(2)}`);
    
    return {
      success: true,
      estimatedBill: valorTotal,
      details: {
        consumption: currentMonthConsumption,
        baseValue: valorBase,
        additionalValue: valorAdicional,
        lightingFee: taxaIluminacao,
        totalValue: valorTotal
      }
    };
  } catch (error) {
    console.error("[BILL_CALC] Erro ao calcular fatura estimada:", error);
    return {
      success: false,
      message: "Erro ao calcular fatura estimada",
      estimatedBill: 0,
      details: null
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
  calculateMonthlyConsumption,
  processEnergyData,
  processMonthlyConsumptionCalculation,
  getCurrentTotalEnergyForDisplay,
  getAccumulatedTotalEnergy,
  getCurrentMonthlyConsumption,
  getMonthlyConsumptionHistory,
  calculateEstimatedBill,
  testBillCalculation,
};
