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
 * Verifica se hoje é o primeiro dia do mês
 * @returns {boolean}
 */
function isFirstDayOfMonth() {
  const today = new Date();
  return today.getDate() === 1;
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

/**
 * Verifica se já salvamos a leitura de energia total para este dispositivo e broker hoje
 * @param {string} deviceId - ID do dispositivo
 * @param {string} broker - Identificador do broker
 * @returns {Promise<boolean>} - True se já salvou hoje, False caso contrário
 */
async function hasAlreadySavedEnergyTotalToday(deviceId, broker) {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  
  const alreadySaved = await prisma.energyTotalBrokers.findFirst({
    where: {
      deviceId,
      broker,
      timestamp: {
        gte: startOfDay,
        lte: endOfDay
      }
    }
  });
  
  return !!alreadySaved;
}

// ==============================================
// Core Processing Functions
// ==============================================

/**
 * Processa dados de energia com lógica especial para totalEnergy
 * @param {Object} energyData - Dados de energia do Tasmota
 * @param {string} deviceId - ID do dispositivo
 * @param {string} tasmotaTopic - Tópico do dispositivo
 * @param {string} brokerLabel - Identificador do broker (broker1 ou broker2)
 * @returns {Object} Dados processados para salvar no banco
 */
async function processEnergyData(energyData, deviceId, tasmotaTopic, brokerLabel) {
  const device = await getDevice(deviceId);
  const dataToSave = prepareBaseData(
    energyData,
    deviceId,
    energyData.timestamp
  );
  
  // Adiciona o brokerLabel aos dados a serem salvos
  dataToSave.brokerLabel = brokerLabel;

  // Verifica se é o último dia do mês
  if (isLastDayOfMonth()) {
    // Verifica se já salvamos o totalEnergy hoje para este dispositivo e broker no novo modelo EnergyTotalBrokers
    const alreadySavedToday = await hasAlreadySavedEnergyTotalToday(deviceId, brokerLabel);
    
    // Só salva se ainda não salvou hoje no novo modelo
    if (!alreadySavedToday && energyData.totalEnergy) {
      const today = new Date();
      
      // Salva no novo modelo EnergyTotalBrokers
      await prisma.energyTotalBrokers.create({
        data: {
          deviceId,
          broker: brokerLabel,
          totalEnergy: energyData.totalEnergy,
          month: today.getMonth() + 1, // Mês (1-12)
          year: today.getFullYear()
        }
      });
      
      console.log(
        `[${tasmotaTopic}] Último dia do mês - Energia total do broker ${brokerLabel} salva: ${energyData.totalEnergy} kWh`
      );
    }
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
    // Buscar o último registro de energia total do dispositivo no modelo EnergyTotalBrokers
    const lastTotalEnergyRecords = await prisma.energyTotalBrokers.findMany({
      where: {
        deviceId,
      },
      orderBy: { timestamp: "desc" },
      take: 1,
    });

    if (lastTotalEnergyRecords && lastTotalEnergyRecords.length > 0) {
      return lastTotalEnergyRecords[0].totalEnergy;
    }

    // Se não encontrar no EnergyTotalBrokers, busca no dispositivo
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
    // Buscar o último registro de energia total do dispositivo no modelo EnergyTotalBrokers
    const lastTotalEnergyRecords = await prisma.energyTotalBrokers.findMany({
      where: {
        deviceId,
      },
      orderBy: { timestamp: "desc" },
      take: 1,
    });

    if (lastTotalEnergyRecords && lastTotalEnergyRecords.length > 0) {
      return lastTotalEnergyRecords[0].totalEnergy;
    }

    // Se não encontrar no EnergyTotalBrokers, busca no dispositivo
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
// Module Exports
// ==============================================

module.exports = {
  isLastDayOfMonth,
  isFirstDayOfMonth,
  isPenultimateDayOfMonth,
  isLastMinuteOfMonth,
  calculateMonthlyConsumption,
  processEnergyData,
  getCurrentTotalEnergyForDisplay,
  getAccumulatedTotalEnergy,
  hasAlreadySavedEnergyTotalToday,
};
