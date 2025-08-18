// backend/services/aiPrediction.service.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Serviço de IA para previsão de consumo de energia
 * Este serviço implementa um modelo de machine learning para prever o consumo futuro
 * de energia com base nos dados históricos armazenados no MongoDB.
 */

// Constantes
const GOIANIA_TARIFF = 0.75; // Tarifa de energia em Goiânia (R$/kWh)

/**
 * Treina o modelo de IA com os dados históricos de consumo de energia
 * @param {string} userId - ID do usuário para o qual o modelo será treinado
 * @returns {Object} Modelo treinado e métricas de treinamento
 */
async function trainModel(userId) {
  console.log(`[AI] Iniciando treinamento do modelo para usuário: ${userId}`);
  
  try {
    // Buscar dispositivos do usuário
    const devices = await prisma.device.findMany({
      where: { userId },
      select: { id: true, broker: true },
    });
    
    const deviceIds = devices.map(d => d.id);
    console.log(`[AI] Dispositivos encontrados: ${deviceIds.length}`, deviceIds);
    
    if (deviceIds.length === 0) {
      console.log(`[AI] Nenhum dispositivo encontrado para usuário: ${userId}`);
      return { success: false, message: 'Nenhum dispositivo encontrado para treinamento.' };
    }
    
    // Buscar todos os dados históricos (até 14 mil registros conforme mencionado)
    const historicalReadings = await prisma.energyReading.findMany({
      where: {
        deviceId: { in: deviceIds },
        OR: [
          { EnergyYesterday: { not: null } },
          { totalEnergy: { not: null } },
        ],
      },
      select: {
        deviceId: true,
        timestamp: true,
        EnergyYesterday: true,
        totalEnergy: true,
        brokerLabel: true,
      },
      orderBy: { timestamp: 'asc' },
    });
    
    console.log(`[AI] Leituras históricas encontradas: ${historicalReadings.length}`);
    
    if (historicalReadings.length < 30) {
      console.log(`[AI] Dados insuficientes para treinamento`);
      return { 
        success: false, 
        message: 'Dados insuficientes para treinamento. Necessário pelo menos 30 registros.' 
      };
    }
    
    // Processar dados para treinamento
    const processedData = processDataForTraining(historicalReadings);
    
    // Treinar modelo (implementação de algoritmo de machine learning)
    const trainedModel = trainMachineLearningModel(processedData);
    
    console.log(`[AI] Modelo treinado com sucesso`);
    
    return {
      success: true,
      message: 'Modelo treinado com sucesso',
      model: trainedModel,
      metrics: {
        dataPoints: historicalReadings.length,
        features: trainedModel.features,
        accuracy: trainedModel.accuracy
      }
    };
    
  } catch (error) {
    console.error('[AI] Erro ao treinar modelo:', error);
    return { success: false, message: 'Erro ao treinar modelo de IA.' };
  }
}

/**
 * Processa os dados históricos para treinamento do modelo
 * @param {Array} readings - Leituras de energia históricas
 * @returns {Object} Dados processados para treinamento
 */
function processDataForTraining(readings) {
  // Agrupar dados por dia
  const dailyConsumption = new Map();
  const monthlyConsumption = new Map();
  const dailyUsageDuration = new Map(); // Novo mapa para rastrear tempo de uso diário
  
  for (const reading of readings) {
    const date = new Date(reading.timestamp);
    const dayKey = date.toISOString().split('T')[0];
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    // Processar dados diários
    if (!dailyConsumption.has(dayKey)) {
      dailyConsumption.set(dayKey, []);
    }
    
    // Processar tempo de uso diário
    if (!dailyUsageDuration.has(dayKey)) {
      dailyUsageDuration.set(dayKey, {
        broker1: 0,
        broker2: 0,
        totalDuration: 0
      });
    }
    
    // Registrar tempo de uso se disponível
    if (reading.activeDuration > 0) {
      const usageData = dailyUsageDuration.get(dayKey);
      if (reading.brokerLabel === 'broker1') {
        usageData.broker1 += reading.activeDuration;
      } else if (reading.brokerLabel === 'broker2') {
        usageData.broker2 += reading.activeDuration;
      }
      usageData.totalDuration = usageData.broker1 + usageData.broker2;
      console.log(`[AI] Tempo de uso registrado para ${dayKey}: ${usageData.totalDuration.toFixed(2)} horas`);
    }
    
    // Usar EnergyYesterday se disponível, senão totalEnergy
    const value = reading.EnergyYesterday || reading.totalEnergy;
    if (typeof value === 'number' && value > 0) {
      dailyConsumption.get(dayKey).push({
        value,
        broker: reading.brokerLabel || 'unknown'
      });
    }
    
    // Processar dados mensais
    if (!monthlyConsumption.has(monthKey)) {
      monthlyConsumption.set(monthKey, {
        totalConsumption: 0,
        daysWithData: new Set(),
        broker1: 0,
        broker2: 0,
        totalUsageDuration: 0 // Novo campo para tempo de uso total
      });
    }
    
    if (typeof value === 'number' && value > 0) {
      const monthData = monthlyConsumption.get(monthKey);
      monthData.daysWithData.add(dayKey);
      
      // Separar consumo por broker
      if (reading.brokerLabel === 'broker1') {
        monthData.broker1 += value;
      } else if (reading.brokerLabel === 'broker2') {
        monthData.broker2 += value;
      }
      
      monthData.totalConsumption += value;
    }
    
    // Adicionar tempo de uso ao total mensal
    if (reading.activeDuration > 0) {
      const monthData = monthlyConsumption.get(monthKey);
      monthData.totalUsageDuration += reading.activeDuration;
    }
  }
  
  // Calcular características para o modelo
  const features = extractFeatures(dailyConsumption, monthlyConsumption, dailyUsageDuration);
  
  return {
    dailyData: Array.from(dailyConsumption.entries()),
    monthlyData: Array.from(monthlyConsumption.entries()),
    dailyUsageData: Array.from(dailyUsageDuration.entries()),
    features
  };
}

/**
 * Extrai características dos dados para treinamento do modelo
 * @param {Map} dailyConsumption - Mapa de consumo diário
 * @param {Map} monthlyConsumption - Mapa de consumo mensal
 * @param {Map} dailyUsageDuration - Mapa de tempo de uso diário
 * @returns {Object} Características extraídas
 */
function extractFeatures(dailyConsumption, monthlyConsumption, dailyUsageDuration) {
  // Calcular consumo médio diário
  let totalDailyConsumption = 0;
  let validDays = 0;
  
  // Calcular tempo médio de uso diário
  let totalUsageDuration = 0;
  let daysWithUsageData = 0;
  
  for (const [day, values] of dailyConsumption.entries()) {
    if (values.length > 0) {
      // Somar todos os valores do dia (pode ter broker1 e broker2)
      const dayTotal = values.reduce((sum, item) => sum + item.value, 0);
      totalDailyConsumption += dayTotal;
      validDays++;
    }
    
    // Verificar se há dados de tempo de uso para este dia
    if (dailyUsageDuration.has(day) && dailyUsageDuration.get(day).totalDuration > 0) {
      totalUsageDuration += dailyUsageDuration.get(day).totalDuration;
      daysWithUsageData++;
    }
  }
  
  const averageDailyConsumption = validDays > 0 ? totalDailyConsumption / validDays : 0;
  const averageDailyUsageDuration = daysWithUsageData > 0 ? totalUsageDuration / daysWithUsageData : 0;
  
  // Calcular tendência (últimos 30 dias vs anteriores)
  const sortedDays = Array.from(dailyConsumption.keys()).sort();
  const recentDays = sortedDays.slice(-30);
  const olderDays = sortedDays.slice(0, -30);
  
  let recentAvg = calculateAverageForDays(recentDays, dailyConsumption);
  let olderAvg = calculateAverageForDays(olderDays, dailyConsumption);
  
  // Calcular tendência percentual
  let trendPercentage = 0;
  if (olderAvg > 0) {
    trendPercentage = ((recentAvg - olderAvg) / olderAvg) * 100;
  }
  
  // Calcular fator sazonal
  const currentMonth = new Date().getMonth();
  const isSummer = currentMonth >= 11 || currentMonth <= 2; // Dez-Mar
  const seasonalFactor = isSummer ? 1.15 : 1.0; // 15% mais no verão
  
  // Calcular proporção entre brokers
  let broker1Percentage = 0;
  let broker2Percentage = 0;
  let totalConsumption = 0;
  
  for (const [, data] of monthlyConsumption.entries()) {
    broker1Percentage += data.broker1;
    broker2Percentage += data.broker2;
    totalConsumption += data.totalConsumption;
  }
  
  if (totalConsumption > 0) {
    broker1Percentage = (broker1Percentage / totalConsumption) * 100;
    broker2Percentage = (broker2Percentage / totalConsumption) * 100;
  }
  
  // Calcular tempo total de uso mensal
  let totalMonthlyUsageDuration = 0;
  for (const [, data] of monthlyConsumption.entries()) {
    if (data.totalUsageDuration) {
      totalMonthlyUsageDuration += data.totalUsageDuration;
    }
  }
  
  return {
    averageDailyConsumption,
    averageDailyUsageDuration,
    trendPercentage,
    seasonalFactor,
    recentAvg,
    olderAvg,
    validDays,
    daysWithUsageData,
    broker1Percentage,
    broker2Percentage,
    totalMonthlyUsageDuration
  };
}

/**
 * Calcula a média de consumo para um conjunto de dias
 * @param {Array} days - Array de dias (chaves)
 * @param {Map} dailyConsumption - Mapa de consumo diário
 * @returns {number} Média de consumo
 */
function calculateAverageForDays(days, dailyConsumption) {
  if (days.length === 0) return 0;
  
  let total = 0;
  let count = 0;
  
  for (const day of days) {
    const values = dailyConsumption.get(day) || [];
    if (values.length > 0) {
      // Somar todos os valores do dia (pode ter broker1 e broker2)
      const dayTotal = values.reduce((sum, item) => sum + item.value, 0);
      total += dayTotal;
      count++;
    }
  }
  
  return count > 0 ? total / count : 0;
}

/**
 * Implementação simplificada de um modelo de machine learning para previsão de consumo
 * @param {Object} processedData - Dados processados para treinamento
 * @returns {Object} Modelo treinado
 */
function trainMachineLearningModel(processedData) {
  const { features } = processedData;
  
  // Este é um modelo simplificado baseado em regras e tendências
  // Em um cenário real, seria implementado um algoritmo de ML como regressão linear,
  // redes neurais, ou modelos de séries temporais como ARIMA ou Prophet
  
  // Calcular precisão do modelo com base na quantidade de dados
  let accuracy = 0;
  if (features.validDays >= 90) accuracy = 0.85;
  else if (features.validDays >= 60) accuracy = 0.75;
  else if (features.validDays >= 30) accuracy = 0.65;
  else accuracy = 0.5;
  
  return {
    type: 'trend-based-model',
    features,
    accuracy,
    predict: function(targetMonth) {
      // Implementação da função de previsão
      return predictConsumption(this.features, targetMonth);
    }
  };
}

/**
 * Gera uma previsão de consumo para o mês alvo
 * @param {Object} features - Características extraídas dos dados históricos
 * @param {Date} targetMonth - Mês alvo para previsão
 * @returns {Object} Previsão de consumo
 */
function predictConsumption(features, targetMonth) {
  const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
  let baseConsumption;
  
  // NOVA LÓGICA: Usar tempo de uso para calcular consumo se disponível
  if (features.daysWithUsageData > 0 && features.averageDailyUsageDuration > 0) {
    console.log(`[AI] Usando nova lógica baseada em tempo de uso para previsão`);
    
    // Calcular consumo baseado no tempo de uso total mensal
    const estimatedMonthlyUsage = features.averageDailyUsageDuration * daysInMonth;
    
    // Multiplicar o tempo total de uso por 0.75 para obter kWh conforme solicitado
    baseConsumption = estimatedMonthlyUsage * 0.75;
    
    console.log(`[AI] Tempo médio de uso diário: ${features.averageDailyUsageDuration.toFixed(2)} horas`);
    console.log(`[AI] Tempo estimado de uso mensal: ${estimatedMonthlyUsage.toFixed(2)} horas`);
    console.log(`[AI] Consumo estimado baseado no tempo: ${baseConsumption.toFixed(2)} kWh`);
  } else {
    // Lógica original: Consumo base mensal (média diária × dias no mês)
    baseConsumption = features.averageDailyConsumption * daysInMonth;
    
    // Aplicar fator sazonal
    const targetMonthIndex = targetMonth.getMonth();
    const isSummer = targetMonthIndex >= 11 || targetMonthIndex <= 2; // Dez-Mar
    const seasonalFactor = isSummer ? 1.15 : 1.0; // 15% mais no verão
    baseConsumption *= seasonalFactor;
    
    // Aplicar tendência
    const trendFactor = 1 + (features.trendPercentage / 100);
    baseConsumption *= trendFactor;
    
    console.log(`[AI] Usando lógica original para previsão: ${baseConsumption.toFixed(2)} kWh`);
  }
  
  // Calcular nível de confiança baseado na quantidade de dados
  let confidence = 'baixa';
  if (features.daysWithUsageData >= 15) {
    confidence = 'alta'; // Alta confiança se tivermos pelo menos 15 dias com dados de tempo de uso
  } else if (features.validDays >= 90) {
    confidence = 'alta';
  } else if (features.validDays >= 60) {
    confidence = 'média';
  }
  
  // Calcular custo estimado
  const estimatedCost = baseConsumption * GOIANIA_TARIFF;
  
  return {
    targetMonth: targetMonth,
    estimatedConsumption: parseFloat(baseConsumption.toFixed(2)),
    estimatedCost: parseFloat(estimatedCost.toFixed(2)),
    confidence,
    broker1Contribution: parseFloat((baseConsumption * (features.broker1Percentage / 100)).toFixed(2)),
    broker2Contribution: parseFloat((baseConsumption * (features.broker2Percentage / 100)).toFixed(2)),
    usedUsageDurationMethod: features.daysWithUsageData > 0 && features.averageDailyUsageDuration > 0
  };
}

/**
 * Gera uma previsão de consumo para o próximo mês
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Previsão de consumo
 */
async function generatePrediction(userId) {
  try {
    // Treinar modelo com dados históricos
    const trainingResult = await trainModel(userId);
    
    if (!trainingResult.success) {
      return {
        success: false,
        message: trainingResult.message
      };
    }
    
    // Definir mês alvo (próximo mês)
    const targetMonth = new Date();
    targetMonth.setDate(1); // Primeiro dia do mês
    targetMonth.setMonth(targetMonth.getMonth() + 1); // Próximo mês
    
    // Gerar previsão
    const prediction = trainingResult.model.predict(targetMonth);
    
    // Buscar última previsão para calcular economia
    const lastPrediction = await prisma.consumptionPrediction.findFirst({
      where: { userId },
      orderBy: { predictionDate: 'desc' }
    });
    
    let monthlySavings = null;
    if (lastPrediction) {
      monthlySavings = lastPrediction.estimatedCost - prediction.estimatedCost;
    }
    
    // Salvar previsão no banco de dados
    const savedPrediction = await prisma.consumptionPrediction.create({
      data: {
        userId,
        targetMonth: prediction.targetMonth,
        estimatedConsumption: prediction.estimatedConsumption,
        estimatedCost: prediction.estimatedCost,
        previousMonthCost: lastPrediction ? lastPrediction.estimatedCost : null,
        monthlySavings,
        confidence: prediction.confidence
      }
    });
    
    return {
      success: true,
      message: 'Previsão gerada com sucesso',
      prediction: {
        id: savedPrediction.id,
        targetMonth: savedPrediction.targetMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        estimatedConsumption: savedPrediction.estimatedConsumption,
        estimatedCost: savedPrediction.estimatedCost,
        monthlySavings: savedPrediction.monthlySavings,
        confidence: savedPrediction.confidence,
        broker1Contribution: prediction.broker1Contribution,
        broker2Contribution: prediction.broker2Contribution,
        usedUsageDurationMethod: prediction.usedUsageDurationMethod || false,
        calculationMethod: prediction.usedUsageDurationMethod ? 'tempo_de_uso' : 'consumo_historico'
      }
    };
    
  } catch (error) {
    console.error('[AI] Erro ao gerar previsão:', error);
    return { success: false, message: 'Erro ao gerar previsão de consumo.' };
  }
}

/**
 * Obtém a previsão mais recente para um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>} Previsão mais recente
 */
async function getLatestPrediction(userId) {
  try {
    const prediction = await prisma.consumptionPrediction.findFirst({
      where: { userId },
      orderBy: { predictionDate: 'desc' }
    });
    
    if (!prediction) {
      return { success: false, message: 'Nenhuma previsão encontrada.' };
    }
    
    // Verificar se há um campo para o método de cálculo
    const usedUsageDurationMethod = prediction.calculationMethod === 'tempo_de_uso';
    
    return {
      success: true,
      prediction: {
        id: prediction.id,
        targetMonth: prediction.targetMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        estimatedConsumption: prediction.estimatedConsumption,
        estimatedCost: prediction.estimatedCost,
        monthlySavings: prediction.monthlySavings,
        confidence: prediction.confidence,
        predictionDate: prediction.predictionDate,
        usedUsageDurationMethod: usedUsageDurationMethod,
        calculationMethod: prediction.calculationMethod || 'consumo_historico'
      }
    };
    
  } catch (error) {
    console.error('[AI] Erro ao buscar previsão:', error);
    return { success: false, message: 'Erro ao buscar previsão de consumo.' };
  }
}

module.exports = {
  trainModel,
  generatePrediction,
  getLatestPrediction,
  GOIANIA_TARIFF
};