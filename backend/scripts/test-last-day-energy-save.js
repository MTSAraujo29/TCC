const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Importar o módulo energyTotalManager com mock
const path = require('path');
const fs = require('fs');

// Criar um mock temporário do módulo
const originalFilePath = path.join(__dirname, '../services/energyTotalManager.js');
const tempFilePath = path.join(__dirname, '../services/energyTotalManager.temp.js');

// Ler o conteúdo original
const originalContent = fs.readFileSync(originalFilePath, 'utf8');

// Modificar o conteúdo para sempre retornar true em isLastDayOfMonth
const modifiedContent = originalContent.replace(
  'function isLastDayOfMonth() {',
  'function isLastDayOfMonth() { return true; /*'
).replace(
  'return today.getDate() === lastDay.getDate();',
  'return true; */ // Original: return today.getDate() === lastDay.getDate();'
);

// Salvar o conteúdo modificado em um arquivo temporário
fs.writeFileSync(tempFilePath, modifiedContent);

// Importar o módulo modificado
const energyTotalManager = require('../services/energyTotalManager.temp');

async function testLastDayEnergySave() {
  try {
    console.log('Simulando processamento de dados de energia no último dia do mês...');
    
    // Buscar dispositivos disponíveis
    const devices = await prisma.device.findMany({
      take: 2
    });
    
    if (devices.length === 0) {
      console.log('Nenhum dispositivo encontrado no banco de dados.');
      return;
    }
    
    console.log(`Encontrados ${devices.length} dispositivos para teste.`);
    
    // Simular dados de energia para cada dispositivo
    for (const device of devices) {
      console.log(`\nProcessando dispositivo: ${device.name} (${device.tasmotaTopic})`);
      
      // Dados simulados de energia
      const energyData = {
        power: 100,
        voltage: 220,
        current: 0.45,
        totalEnergy: 1234.56, // Valor simulado de energia total
        EnergyToday: 1.23,
        EnergyYesterday: 1.45,
        ApparentPower: 110,
        ReactivePower: 45,
        PowerFactor: 0.9,
        timestamp: new Date()
      };
      
      console.log('Dados de energia simulados:', JSON.stringify(energyData, null, 2));
      
      // Processar dados usando o energyTotalManager
      const processedData = await energyTotalManager.processEnergyData(
        energyData,
        device.id,
        device.tasmotaTopic,
        device.broker || 'broker1'
      );
      
      console.log('Dados processados:', JSON.stringify(processedData, null, 2));
      
      // Verificar se o totalEnergy não está presente nos dados processados
      if (processedData.totalEnergy === undefined) {
        console.log('✅ Campo totalEnergy não está presente nos dados processados para EnergyReading');
      } else {
        console.log(`⚠️ Campo totalEnergy ainda está presente nos dados processados: ${processedData.totalEnergy}`);
      }
      
      // Salvar os dados processados no banco
      const savedReading = await prisma.energyReading.create({
        data: processedData
      });
      
      console.log(`Leitura salva com ID: ${savedReading.id}`);
    }
    
    // Verificar registros em EnergyTotalBrokers
    const energyTotalRecords = await prisma.energyTotalBrokers.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      take: 5
    });
    
    console.log(`\nÚltimos ${energyTotalRecords.length} registros de EnergyTotalBrokers:`);
    
    // Exibir detalhes de cada registro
    for (const record of energyTotalRecords) {
      console.log('\n-----------------------------------');
      console.log(`ID: ${record.id}`);
      console.log(`Device ID: ${record.deviceId}`);
      console.log(`Broker: ${record.broker}`);
      console.log(`Total Energy: ${record.totalEnergy} kWh`);
      console.log(`Mês/Ano: ${record.month}/${record.year}`);
      console.log(`Timestamp: ${record.timestamp}`);
    }
    
  } catch (error) {
    console.error('Erro ao testar salvamento de energia no último dia do mês:', error);
  } finally {
    // Limpar o arquivo temporário
    try {
      fs.unlinkSync(tempFilePath);
      console.log('Arquivo temporário removido com sucesso.');
    } catch (err) {
      console.error('Erro ao remover arquivo temporário:', err);
    }
    
    await prisma.$disconnect();
  }
}

testLastDayEnergySave();