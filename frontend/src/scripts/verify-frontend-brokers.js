// frontend/src/scripts/verify-frontend-brokers.js

// Este script verifica se os dispositivos estão sendo carregados corretamente com o campo broker
// Para usar, adicione temporariamente este código no componente DashboardPage.js
// e verifique o console do navegador

// Função para verificar se os dispositivos têm o campo broker definido
function verifyDeviceBrokers(devices) {
  console.log('=== VERIFICAÇÃO DE BROKERS NO FRONTEND ===');
  console.log('Dispositivos carregados:', devices);
  
  if (!devices || devices.length === 0) {
    console.log('❌ Nenhum dispositivo encontrado!');
    return;
  }
  
  // Verificar se cada dispositivo tem o campo broker
  const devicesWithoutBroker = devices.filter(d => !d.broker);
  
  if (devicesWithoutBroker.length > 0) {
    console.log('❌ PROBLEMA: Dispositivos sem broker definido:');
    devicesWithoutBroker.forEach(device => {
      console.log(`- ${device.name} (ID: ${device.id})`);
    });
  } else {
    console.log('✅ Todos os dispositivos têm o campo broker definido.');
  }
  
  // Verificar se a função getTotalEnergyByBroker funciona corretamente
  console.log('\nTestando função getTotalEnergyByBroker:');
  
  function getTotalEnergyByBroker(devices, brokerLabel) {
    console.log(`Buscando dispositivo com broker=${brokerLabel}`);
    const device = devices.find((d) => {
      console.log(`Verificando dispositivo: ${d.name}, broker=${d.broker}`);
      return d.broker === brokerLabel;
    });
    
    console.log('Dispositivo encontrado:', device);
    
    return device &&
      device.latestReading &&
      typeof device.latestReading.totalEnergy === "number"
      ? device.latestReading.totalEnergy
      : 0;
  }
  
  const broker1Energy = getTotalEnergyByBroker(devices, 'broker1');
  const broker2Energy = getTotalEnergyByBroker(devices, 'broker2');
  
  console.log(`Energia total do Broker 1: ${broker1Energy} kWh`);
  console.log(`Energia total do Broker 2: ${broker2Energy} kWh`);
}

// Exportar a função para uso no componente
export default verifyDeviceBrokers;