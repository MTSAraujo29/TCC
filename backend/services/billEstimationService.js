// backend/services/billEstimationService.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const energyTotalManager = require('./energyTotalManager');

// Constantes para cálculo da fatura de energia em Goiânia, Goiás
const ENERGY_PRICE_PER_KWH = 0.65; // Valor médio por kWh em Goiânia (R$)
const FIXED_CHARGES = 15.00; // Taxas fixas (R$)

/**
 * Calcula o consumo total de energia entre os dois últimos registros de cada broker
 * @returns {Promise<{totalConsumption: number, billAmount: number}>}
 */
async function calculateLastMonthConsumption() {
  try {
    // Buscar os dois últimos registros de cada broker
    const broker1Records = await prisma.energyTotalBrokers.findMany({
      where: { broker: 'broker1' },
      orderBy: { timestamp: 'desc' },
      take: 2
    });

    const broker2Records = await prisma.energyTotalBrokers.findMany({
      where: { broker: 'broker2' },
      orderBy: { timestamp: 'desc' },
      take: 2
    });

    // Calcular consumo do broker1
    let broker1Consumption = 0;
    if (broker1Records.length >= 2) {
      // Sempre pegar o maior valor menos o menor para lidar com possíveis resets
      const latest = broker1Records[0].totalEnergy;
      const previous = broker1Records[1].totalEnergy;
      broker1Consumption = Math.max(latest, previous) - Math.min(latest, previous);
    }

    // Calcular consumo do broker2
    let broker2Consumption = 0;
    if (broker2Records.length >= 2) {
      // Sempre pegar o maior valor menos o menor para lidar com possíveis resets
      const latest = broker2Records[0].totalEnergy;
      const previous = broker2Records[1].totalEnergy;
      broker2Consumption = Math.max(latest, previous) - Math.min(latest, previous);
    }

    // Consumo total é a soma dos dois brokers
    const totalConsumption = broker1Consumption + broker2Consumption;
    
    // Calcular valor estimado da fatura
    const billAmount = calculateBillAmount(totalConsumption);

    return {
      totalConsumption,
      billAmount
    };
  } catch (error) {
    console.error('Erro ao calcular consumo do último mês:', error);
    return {
      totalConsumption: 0,
      billAmount: 0
    };
  }
}

/**
 * Calcula o valor estimado da fatura com base no consumo
 * @param {number} consumption - Consumo em kWh
 * @returns {number} - Valor estimado da fatura em R$
 */
function calculateBillAmount(consumption) {
  return (consumption * ENERGY_PRICE_PER_KWH) + FIXED_CHARGES;
}

/**
 * Salva os dados de economia mensal no primeiro dia do mês
 * @returns {Promise<boolean>} - True se salvou com sucesso, False caso contrário
 */
async function saveMonthlySavings() {
  try {
    // Verificar se é o primeiro dia do mês
    if (!energyTotalManager.isFirstDayOfMonth()) {
      return false;
    }

    // Verificar se já salvou hoje
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const alreadySavedToday = await prisma.monthlySavings.findFirst({
      where: {
        timestamp: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    });

    if (alreadySavedToday) {
      console.log('Já salvou os dados de economia hoje, ignorando.');
      return false;
    }

    // Calcular consumo e valor da fatura
    const { totalConsumption, billAmount } = await calculateLastMonthConsumption();

    // Salvar no banco
    await prisma.monthlySavings.create({
      data: {
        month: today.getMonth() + 1, // Mês (1-12)
        year: today.getFullYear(),
        billAmount: parseFloat(billAmount.toFixed(2)),
        totalConsumption: parseFloat(totalConsumption.toFixed(2))
      }
    });

    console.log(`Dados de economia mensal salvos: ${totalConsumption.toFixed(2)} kWh, R$ ${billAmount.toFixed(2)}`);
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados de economia mensal:', error);
    return false;
  }
}

/**
 * Calcula a economia mensal comparando os dois últimos registros
 * @returns {Promise<{savingsAmount: number, isPositive: boolean}>}
 */
async function calculateMonthlySavings() {
  try {
    // Buscar os dois últimos registros
    const lastTwoRecords = await prisma.monthlySavings.findMany({
      orderBy: { timestamp: 'desc' },
      take: 2
    });

    if (lastTwoRecords.length < 2) {
      return { savingsAmount: 0, isPositive: true };
    }

    // Calcular diferença entre os dois últimos valores
    const currentBill = lastTwoRecords[0].billAmount;
    const previousBill = lastTwoRecords[1].billAmount;
    const savingsAmount = previousBill - currentBill;

    return {
      savingsAmount: Math.abs(savingsAmount),
      isPositive: savingsAmount >= 0
    };
  } catch (error) {
    console.error('Erro ao calcular economia mensal:', error);
    return { savingsAmount: 0, isPositive: true };
  }
}

/**
 * Obtém os dados para exibição no dashboard
 * @returns {Promise<{lastMonthBill: number, monthlySavings: number, isPositiveSavings: boolean, lastMonthConsumption: number}>}
 */
async function getBillDataForDashboard() {
  try {
    // Verificar se é o primeiro dia do mês e salvar dados se necessário
    if (energyTotalManager.isFirstDayOfMonth()) {
      await saveMonthlySavings();
    }

    // Buscar último registro de economia mensal para a fatura
    const lastSavingsRecord = await prisma.monthlySavings.findFirst({
      orderBy: { timestamp: 'desc' }
    });

    // Calcular economia mensal
    const { savingsAmount, isPositive } = await calculateMonthlySavings();

    return {
      lastMonthBill: lastSavingsRecord ? lastSavingsRecord.billAmount : 0,
      monthlySavings: savingsAmount,
      isPositiveSavings: isPositive,
      lastMonthConsumption: lastSavingsRecord ? lastSavingsRecord.totalConsumption : 0
    };
  } catch (error) {
    console.error('Erro ao obter dados de fatura para o dashboard:', error);
    return {
      lastMonthBill: 0,
      monthlySavings: 0,
      isPositiveSavings: true,
      lastMonthConsumption: 0
    };
  }
}

module.exports = {
  calculateLastMonthConsumption,
  calculateBillAmount,
  saveMonthlySavings,
  calculateMonthlySavings,
  getBillDataForDashboard
};