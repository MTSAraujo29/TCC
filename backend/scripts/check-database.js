// backend/scripts/check-database.js

/**
 * Script para verificar se os dados de energia estão sendo salvos no banco de dados
 * Este script consulta o banco de dados para verificar as leituras de energia mais recentes
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('=== VERIFICAÇÃO DO BANCO DE DADOS ===');
console.log('Este script verifica se os dados de energia estão sendo salvos no banco de dados');

// Função para formatar data
function formatDate(date) {
  return new Date(date).toLocaleString('pt-BR');
}

// Função para verificar dispositivos e suas leituras
async function checkDevices() {
  try {
    // Buscar todos os dispositivos
    console.log('\nBuscando dispositivos...');
    const devices = await prisma.device.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });
    
    console.log(`Encontrados ${devices.length} dispositivos no banco de dados.`);
    
    // Exibir informações de cada dispositivo
    for (const device of devices) {
      console.log('\n----------------------------------------');
      console.log(`Dispositivo: ${device.tasmotaTopic}`);
      console.log(`ID: ${device.id}`);
      console.log(`MAC: ${device.macAddress}`);
      console.log(`Modelo: ${device.model}`);
      console.log(`Broker: ${device.broker}`);
      console.log(`Estado: ${device.powerState ? 'LIGADO' : 'DESLIGADO'}`);
      console.log(`Última visualização: ${device.lastSeen ? formatDate(device.lastSeen) : 'Nunca'}`);
      console.log(`Última energia total: ${device.lastSavedTotalEnergy || 'N/A'}`);
      console.log(`Usuário: ${device.user.name} (${device.user.email})`);
      
      // Buscar as leituras de energia mais recentes para este dispositivo
      const recentReadings = await prisma.energyReading.findMany({
        where: { deviceId: device.id },
        orderBy: { timestamp: 'desc' },
        take: 5
      });
      
      if (recentReadings.length > 0) {
        console.log('\nLeituras de energia mais recentes:');
        recentReadings.forEach((reading, index) => {
          console.log(`${index + 1}. ${formatDate(reading.timestamp)} - Total: ${reading.totalEnergy} kWh, Diário: ${reading.dailyEnergy} kWh`);
        });
      } else {
        console.log('\nNenhuma leitura de energia encontrada para este dispositivo.');
      }
    }
    
    // Verificar se há leituras recentes (últimas 24 horas)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const recentReadingsCount = await prisma.energyReading.count({
      where: {
        timestamp: {
          gte: oneDayAgo
        }
      }
    });
    
    console.log('\n----------------------------------------');
    console.log(`Leituras nas últimas 24 horas: ${recentReadingsCount}`);
    
    if (recentReadingsCount === 0) {
      console.log('\nAVISO: Não há leituras de energia nas últimas 24 horas!');
      console.log('Isso pode indicar que o sistema não está salvando os dados corretamente.');
    } else {
      console.log(`\nMédia de ${(recentReadingsCount / 24).toFixed(2)} leituras por hora.`);
    }
    
  } catch (error) {
    console.error('Erro ao verificar o banco de dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar a verificação
checkDevices();