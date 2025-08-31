// backend/scripts/verify-device-brokers.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDeviceBrokers() {
  try {
    console.log('Verificando dispositivos e seus brokers...');
    
    // Buscar todos os dispositivos
    const devices = await prisma.device.findMany();
    
    console.log('\nDispositivos encontrados:');
    if (devices.length === 0) {
      console.log('Nenhum dispositivo encontrado no banco de dados.');
    } else {
      for (const device of devices) {
        console.log(`\nID: ${device.id}`);
        console.log(`Nome: ${device.name}`);
        console.log(`Tópico Tasmota: ${device.tasmotaTopic}`);
        console.log(`Broker: ${device.broker || 'Não definido'}`);
        console.log(`Estado: ${device.powerState ? 'Ligado' : 'Desligado'}`);
      }
    }
    
    // Verificar se há dispositivos sem broker definido
    const devicesWithoutBroker = devices.filter(d => !d.broker);
    if (devicesWithoutBroker.length > 0) {
      console.log('\n⚠️ ATENÇÃO: Dispositivos sem broker definido:');
      for (const device of devicesWithoutBroker) {
        console.log(`- ${device.name} (${device.tasmotaTopic})`);
      }
      console.log('\nO campo broker é necessário para que o frontend identifique corretamente os dispositivos.');
    } else {
      console.log('\n✅ Todos os dispositivos têm o campo broker definido.');
    }
    
    // Verificar se há dispositivos com broker inválido
    const validBrokers = ['broker1', 'broker2'];
    const devicesWithInvalidBroker = devices.filter(d => d.broker && !validBrokers.includes(d.broker));
    if (devicesWithInvalidBroker.length > 0) {
      console.log('\n⚠️ ATENÇÃO: Dispositivos com broker inválido:');
      for (const device of devicesWithInvalidBroker) {
        console.log(`- ${device.name} (${device.tasmotaTopic}): ${device.broker}`);
      }
      console.log('\nOs valores válidos para o campo broker são: broker1, broker2');
    } else if (devices.length > 0) {
      console.log('\n✅ Todos os dispositivos têm valores válidos para o campo broker.');
    }
    
  } catch (error) {
    console.error('Erro ao verificar dispositivos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDeviceBrokers();