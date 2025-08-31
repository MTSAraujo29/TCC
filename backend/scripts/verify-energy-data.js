const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyEnergyData() {
  try {
    console.log('Verificando dados de energia no banco de dados...');
    
    // Buscar as últimas 10 leituras de energia
    const recentReadings = await prisma.energyReading.findMany({
      take: 10,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        device: true
      }
    });
    
    console.log(`\nÚltimas ${recentReadings.length} leituras de energia:`);
    
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
      console.log(`  - Energia Total: ${reading.totalEnergy} kWh`);
      console.log(`  - Energia Hoje: ${reading.EnergyToday} kWh`);
      console.log(`  - Energia Ontem: ${reading.EnergyYesterday} kWh`);
      console.log(`  - Potência Aparente: ${reading.ApparentPower} VA`);
      console.log(`  - Potência Reativa: ${reading.ReactivePower} var`);
      console.log(`  - Fator de Potência: ${reading.PowerFactor}`);
    }
    
    // Verificar se há valores undefined
    const readingsWithUndefined = recentReadings.filter(reading => {
      return reading.totalEnergy === undefined || 
             reading.EnergyToday === undefined || 
             reading.EnergyYesterday === undefined;
    });
    
    if (readingsWithUndefined.length > 0) {
      console.log('\n⚠️ ATENÇÃO: Encontrados valores undefined nas leituras:');
      console.log(`Número de leituras com valores undefined: ${readingsWithUndefined.length}`);
    } else {
      console.log('\n✅ Todos os valores de energia estão definidos corretamente!');
    }
    
  } catch (error) {
    console.error('Erro ao verificar dados de energia:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyEnergyData();