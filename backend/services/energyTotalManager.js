/**
 * Gerenciador de Energia Total
 * 
 * Serviço especializado no processamento e cálculo de dados de energia
 * dos dispositivos Tasmota. Implementa lógica específica para:
 * - Cálculo de consumo mensal baseado em diferenças
 * - Processamento de dados com timestamp para fuso horário brasileiro
 * - Gerenciamento de resets de dispositivos
 * - Salvamento inteligente de dados de energia total
 * 
 * @module EnergyTotalManager
 * @requires @prisma/client
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// === FUNÇÕES UTILITÁRIAS DE DATA ===

/**
 * Verifica se hoje é o último dia do mês
 * Usado para determinar quando salvar dados mensais
 * 
 * @returns {boolean} True se for o último dia do mês
 */
function isLastDayOfMonth() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return today.getDate() === lastDay.getDate();
}

/**
 * Verifica se hoje é o penúltimo dia do mês
 * Usado para preparação de fechamento mensal
 * 
 * @returns {boolean} True se for o penúltimo dia do mês
 */
function isPenultimateDayOfMonth() {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return today.getDate() === lastDay.getDate() - 1;
}

/**
 * Verifica se é o último minuto do último dia do mês (23:59)
 * Momento exato para consolidação mensal de dados
 * 
 * @returns {boolean} True se for 23:59 do último dia do mês
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

// === FUNÇÕES DE CÁLCULO ===

/**
 * Calcula o consumo mensal de energia baseado na diferença
 * entre valor atual e último valor salvo
 * 
 * Trata casos especiais como reset do dispositivo (valores negativos)
 * 
 * @param {number} currentTotalEnergy - Valor atual do totalEnergy do Tasmota
 * @param {number} lastSavedTotalEnergy - Último valor salvo no banco
 * @returns {number} Consumo mensal calculado em kWh
 */
function calculateMonthlyConsumption(currentTotalEnergy, lastSavedTotalEnergy) {
  // Primeiro mês ou dispositivo novo
  if (!lastSavedTotalEnergy || lastSavedTotalEnergy === 0) {
    return currentTotalEnergy;
  }

  const monthlyConsumption = currentTotalEnergy - lastSavedTotalEnergy;

  // Detecta possível reset do dispositivo (valor negativo)
  if (monthlyConsumption < 0) {
    console.log(
      `Valor negativo detectado: ${monthlyConsumption}. Possível reset do Tasmota. Retornando valor atual: ${currentTotalEnergy}`
    );
    return currentTotalEnergy;
  }

  return monthlyConsumption;
}

// === PROCESSAMENTO PRINCIPAL ===

/**
 * Processa dados de energia com lógica especial para totalEnergy
 * 
 * Implementa a estratégia de salvamento mensal:
 * - Salva totalEnergy apenas no último minuto do mês
 * - Calcula consumo mensal automaticamente
 * - Atualiza referência para próximo mês
 * 
 * @param {Object} energyData - Dados de energia do Tasmota
 * @param {string} deviceId - ID do dispositivo no banco
 * @param {string} tasmotaTopic - Tópico MQTT do dispositivo
 * @returns {Object} Dados processados prontos para salvamento
 */
async function processEnergyData(energyData, deviceId, tasmotaTopic) {
  const device = await getDevice(deviceId);
  const dataToSave = prepareBaseData(
    energyData,
    deviceId,
    energyData.timestamp
  );

  // Lógica especial: só salva totalEnergy no fechamento mensal
  if (isLastMinuteOfMonth()) {
    const lastMonthTotal = device.lastSavedTotalEnergy || 0;
    const monthlyConsumption = calculateMonthlyConsumption(
      energyData.totalEnergy,
      lastMonthTotal
    );
    
    dataToSave.totalEnergy = monthlyConsumption;
    
    // Atualiza referência para próximo mês
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastSavedTotalEnergy: energyData.totalEnergy },
    });
    
    console.log(
      `[${tasmotaTopic}] Fechamento mensal - Consumo: ${monthlyConsumption} kWh (Total acumulado: ${energyData.totalEnergy} kWh)`
    );
  } else {
    // Fora do período de fechamento, não salva totalEnergy
    dataToSave.totalEnergy = null;
  }

  return dataToSave;
}

// === FUNÇÕES AUXILIARES ===

/**
 * Busca dispositivo no banco de dados
 * 
 * @param {string} deviceId - ID do dispositivo
 * @returns {Promise<Object>} Dados do dispositivo
 * @throws {Error} Se dispositivo não for encontrado
 */
async function getDevice(deviceId) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
  });

  if (!device) {
    throw new Error(`Dispositivo não encontrado: ${deviceId}`);
  }
  return device;
}

/**
 * Prepara dados base para salvamento no banco
 * Converte timestamp para fuso horário brasileiro
 * 
 * @param {Object} energyData - Dados brutos de energia
 * @param {string} deviceId - ID do dispositivo
 * @param {string|Date} timestamp - Timestamp dos dados
 * @returns {Object} Dados formatados para o banco
 */
function prepareBaseData(energyData, deviceId, timestamp) {
  // Conversão para fuso horário de Brasília (America/Sao_Paulo)
  let dateBrasilia;
  if (timestamp) {
    dateBrasilia = new Date(
      new Date(timestamp).toLocaleString("en-US", {
        timeZone: "America/Sao_Paulo",
      })
    );
  } else {
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

// === FUNÇÕES DE CONSULTA ===

/**
 * Obtém valor atual de energia total para exibição no frontend
 * 
 * Busca primeiro na tabela de leituras, depois no device
 * como fallback para garantir que sempre retorne um valor
 * 
 * @param {string} deviceId - ID do dispositivo
 * @returns {Promise<number|null>} Valor de energia total ou null
 */
async function getCurrentTotalEnergyForDisplay(deviceId) {
  try {
    // Busca última leitura com totalEnergy salvo
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

    // Fallback: busca no device
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
 * Obtém valor acumulado real do Tasmota
 * 
 * Retorna o valor bruto acumulado pelo dispositivo,
 * usado para cálculos internos e validações
 * 
 * @param {string} deviceId - ID do dispositivo
 * @returns {Promise<number|null>} Valor acumulado ou null
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

// === EXPORTAÇÕES ===
module.exports = {
  // Funções de verificação temporal
  isLastDayOfMonth,
  isPenultimateDayOfMonth,
  isLastMinuteOfMonth,
  
  // Funções de cálculo
  calculateMonthlyConsumption,
  
  // Processamento principal
  processEnergyData,
  
  // Funções de consulta
  getCurrentTotalEnergyForDisplay,
  getAccumulatedTotalEnergy,
};
