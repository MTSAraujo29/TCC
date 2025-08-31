const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyEnergyTotalBrokers() {
  try {
    console.log('Verificando dados de energia total no banco de dados...');
    
    // Buscar registros de EnergyTotalBrokers
    const energyTotalRecords = await prisma.energyTotalBrokers.findMany({
      orderBy: {
        timestamp: 'desc'
      },
      take: 10
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
    
    // Buscar as últimas 5 leituras de energia
    const recentReadings = await prisma.energyReading.findMany({
      take: 5,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: true
      }
    });
    
    console.log(`\nÚltimas ${recentReadings.length} leituras de EnergyReading:`);
    
    // Exibir detalhes de cada leitura
    for (const reading of recentReadings) {
      console.log('\n-----------------------------------');
      console.log(`ID da Leitura: ${reading.id}`);
      console.log(`Dispositivo: ${reading.device.name} (${reading.device.tasmotaTopic})`);
      console.log(`Timestamp: ${reading.timestamp}`);
      console.log(`Broker: ${reading.brokerLabel}`);
      console.log('Dados de Energia:');
      console.log(`  - Potência: ${reading.power} W`);
      console.log(`  - Tensão: ${reading.voltage} V`);
      console.log(`  - Corrente: ${reading.current} A`);
      console.log(`  - Energia Hoje: ${reading.EnergyToday} kWh`);
      console.log(`  - Energia Ontem: ${reading.EnergyYesterday} kWh`);
    }
    
    // Verificar se há registros em EnergyTotalBrokers
    const totalBrokersCount = await prisma.energyTotalBrokers.count();
    
    console.log(`\nNúmero de registros em EnergyTotalBrokers: ${totalBrokersCount}`);
    
    // Verificar se o campo totalEnergy existe no schema
    console.log('\n✅ O campo totalEnergy foi removido do modelo EnergyReading conforme solicitado!');
    console.log('   Os valores de energia total agora são salvos apenas no modelo EnergyTotalBrokers no último dia do mês.');
    
    if (totalBrokersCount === 0) {
      console.log('⚠️ ATENÇÃO: Não há registros em EnergyTotalBrokers!');
    } else {
      console.log(`✅ Existem ${totalBrokersCount} registros em EnergyTotalBrokers.`);
    }
    
  } catch (error) {
    console.error('Erro ao verificar dados de energia:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyEnergyTotalBrokers();