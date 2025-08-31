// backend/scripts/test-dashboard-api.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const energyTotalManager = require('../services/energyTotalManager');

async function testDashboardAPI() {
  try {
    console.log('Simulando resposta da API do dashboard...');
    
    // Buscar um usuário para teste
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('Nenhum usuário encontrado no banco de dados.');
      return;
    }
    
    console.log(`\nUsuário de teste: ${user.name} (${user.email})`);
    
    // Buscar os dispositivos do usuário
    const userDevices = await prisma.device.findMany({
      where: { userId: user.id },
      include: {
        readings: {
          where: { power: { gt: 0 } },
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
    });
    
    console.log(`\nDispositivos do usuário: ${userDevices.length}`);
    
    // Preparar os dados como seriam enviados para o frontend
    const realDevicesData = [];
    
    for (const device of userDevices) {
      const latestReading = device.readings.length > 0 ? device.readings[0] : null;
      const totalEnergyFromBroker = await energyTotalManager.getCurrentTotalEnergyForDisplay(device.id);
      
      // Construir o objeto como seria enviado para o frontend
      const deviceData = {
        id: device.id,
        name: device.name,
        tasmotaTopic: device.tasmotaTopic,
        macAddress: device.macAddress,
        model: device.model,
        powerState: device.powerState,
        broker: device.broker, // Campo importante para o frontend
        totalEnergy: totalEnergyFromBroker || 0,
        latestReading: latestReading
          ? {
              power: latestReading.power,
              voltage: latestReading.voltage,
              current: latestReading.current,
              totalEnergy: totalEnergyFromBroker,
              EnergyToday: latestReading.EnergyToday,
              EnergyYesterday: latestReading.EnergyYesterday,
              timestamp: latestReading.timestamp,
            }
          : null,
      };
      
      realDevicesData.push(deviceData);
    }
    
    // Exibir os dados que seriam enviados para o frontend
    console.log('\nDados que seriam enviados para o frontend:');
    console.log(JSON.stringify(realDevicesData, null, 2));
    
    // Verificar se todos os dispositivos têm o campo broker
    const devicesWithoutBroker = realDevicesData.filter(d => !d.broker);
    if (devicesWithoutBroker.length > 0) {
      console.log('\n⚠️ ATENÇÃO: Dispositivos sem broker definido nos dados da API:');
      for (const device of devicesWithoutBroker) {
        console.log(`- ${device.name} (${device.tasmotaTopic})`);
      }
    } else {
      console.log('\n✅ Todos os dispositivos nos dados da API têm o campo broker definido.');
    }
    
    // Testar a função getTotalEnergyByBroker do frontend
    console.log('\nSimulando a função getTotalEnergyByBroker do frontend:');
    
    function getTotalEnergyByBroker(devices, brokerLabel) {
      const device = devices.find((d) => d.broker === brokerLabel);
      return device &&
        device.latestReading &&
        typeof device.latestReading.totalEnergy === "number"
        ? device.latestReading.totalEnergy
        : 0;
    }
    
    const broker1Energy = getTotalEnergyByBroker(realDevicesData, 'broker1');
    const broker2Energy = getTotalEnergyByBroker(realDevicesData, 'broker2');
    
    console.log(`Energia total do Broker 1: ${broker1Energy} kWh`);
    console.log(`Energia total do Broker 2: ${broker2Energy} kWh`);
    
  } catch (error) {
    console.error('Erro ao testar API do dashboard:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardAPI();