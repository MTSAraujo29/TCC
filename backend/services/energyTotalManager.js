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
    const lastMonthTotal = device.lastSavedTotalEnergy || 0;
    const monthlyConsumption = calculateMonthlyConsumption(
      energyData.totalEnergy,
      lastMonthTotal
    );
    dataToSave.totalEnergy = monthlyConsumption;
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSavedTotalEnergy: energyData.totalEnergy },
    });
    console.log(
      `[${tasmotaTopic}] Último minuto do mês - Consumo mensal calculado: ${monthlyConsumption} kWh (Total acumulado: ${energyData.totalEnergy} kWh)`
    );
  } else {
    dataToSave.totalEnergy = null;
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
// Module Exports
// ==============================================

module.exports = {
  isLastDayOfMonth,
  isPenultimateDayOfMonth,
  isLastMinuteOfMonth,
  calculateMonthlyConsumption,
  processEnergyData,
  getCurrentTotalEnergyForDisplay,
  getAccumulatedTotalEnergy,
};
