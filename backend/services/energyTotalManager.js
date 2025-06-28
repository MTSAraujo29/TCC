// backend/services/energyTotalManager.js

const { PrismaClient } = require('@prisma/client');
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
    return today.getDate() === (lastDay.getDate() - 1);
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
        console.log(`Valor negativo detectado: ${monthlyConsumption}. Possível reset do Tasmota. Retornando valor atual: ${currentTotalEnergy}`);
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
    const {
        power,
        voltage,
        current,
        totalEnergy,
        EnergyToday,
        EnergyYesterday,
        ApparentPower,
        ReactivePower,
        PowerFactor,
        timestamp
    } = energyData;

    const device = await getDevice(deviceId);
    const dataToSave = prepareBaseData(energyData, deviceId, timestamp);

    // Lógica especial para totalEnergy
    if (isLastDayOfMonth()) {
        await handleLastDayOfMonth(totalEnergy, deviceId, tasmotaTopic, dataToSave, device);
    } else {
        dataToSave.totalEnergy = null;
        console.log(`[${tasmotaTopic}] Dia normal - totalEnergy não salvo (valor atual: ${totalEnergy} kWh)`);
    }

    return dataToSave;
}

// ==============================================
// Helper Functions
// ==============================================

async function getDevice(deviceId) {
    const device = await prisma.device.findUnique({
        where: { id: deviceId }
    });

    if (!device) {
        throw new Error(`Dispositivo não encontrado: ${deviceId}`);
    }
    return device;
}

function prepareBaseData(energyData, deviceId, timestamp) {
    return {
        deviceId,
        timestamp: timestamp || new Date(),
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

async function handleLastDayOfMonth(totalEnergy, deviceId, tasmotaTopic, dataToSave, device) {
    const monthlyConsumption = calculateMonthlyConsumption(totalEnergy, device.lastSavedTotalEnergy || 0);
    dataToSave.totalEnergy = monthlyConsumption;

    await prisma.device.update({
        where: { id: deviceId },
        data: { lastSavedTotalEnergy: totalEnergy }
    });

    console.log(`[${tasmotaTopic}] Último dia do mês - Consumo mensal calculado: ${monthlyConsumption} kWh (Total acumulado: ${totalEnergy} kWh)`);
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
                totalEnergy: { not: null }
            },
            orderBy: { timestamp: 'desc' }
        });

        if (lastReadingWithTotal) {
            return lastReadingWithTotal.totalEnergy;
        }

        const device = await prisma.device.findUnique({
            where: { id: deviceId }
        });

        return device?.lastSavedTotalEnergy || null;
    } catch (error) {
        console.error('Erro ao obter energia total para exibição:', error);
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
            where: { id: deviceId }
        });

        return device?.lastSavedTotalEnergy || null;
    } catch (error) {
        console.error('Erro ao obter energia total acumulada:', error);
        return null;
    }
}

// ==============================================
// Module Exports
// ==============================================

module.exports = {
    isLastDayOfMonth,
    isPenultimateDayOfMonth,
    calculateMonthlyConsumption,
    processEnergyData,
    getCurrentTotalEnergyForDisplay,
    getAccumulatedTotalEnergy
};