// frontend/src/scripts/debug-broker-communication.js

/**
 * Este script deve ser adicionado temporariamente ao DashboardPage.js para depurar
 * a comunicação entre o frontend e o backend relacionada aos brokers.
 * 
 * Para usar:
 * 1. Importe este arquivo no DashboardPage.js
 * 2. Chame a função debugBrokerCommunication() no useEffect após fetchDashboardData()
 */

import { API_ENDPOINTS } from '../config/api';

async function debugBrokerCommunication() {
  console.log('=== INICIANDO DEPURAÇÃO DE COMUNICAÇÃO DE BROKERS ===');
  
  try {
    // 1. Verificar token
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('❌ Token não encontrado. Usuário não está autenticado.');
      return;
    }
    
    // 2. Fazer requisição direta ao endpoint de dados do dashboard
    console.log('Fazendo requisição direta ao endpoint de dados do dashboard...');
    const response = await fetch(`${API_ENDPOINTS.DASHBOARD}/data`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Erro na requisição: ${response.status} ${response.statusText}`);
      return;
    }
    
    // 3. Analisar a resposta
    const data = await response.json();
    console.log('Resposta completa do backend:', data);
    
    // 4. Verificar especificamente os dispositivos e seus brokers
    const devices = data.userDevices || [];
    console.log('Dispositivos recebidos:', devices);
    
    if (devices.length === 0) {
      console.log('❌ Nenhum dispositivo encontrado na resposta!');
      return;
    }
    
    // 5. Verificar cada dispositivo
    devices.forEach((device, index) => {
      console.log(`\nDispositivo ${index + 1}: ${device.name}`);
      console.log(`ID: ${device.id}`);
      console.log(`Broker: ${device.broker || 'NÃO DEFINIDO'}`);
      console.log(`Power State: ${device.powerState ? 'Ligado' : 'Desligado'}`);
      console.log('Latest Reading:', device.latestReading);
      
      if (!device.broker) {
        console.error(`❌ PROBLEMA: Dispositivo ${device.name} não tem broker definido!`);
      }
    });
    
    // 6. Testar a função getTotalEnergyByBroker
    console.log('\nSimulando a função getTotalEnergyByBroker:');
    
    function getTotalEnergyByBroker(devices, brokerLabel) {
      console.log(`Buscando dispositivo com broker=${brokerLabel}`);
      const device = devices.find((d) => d.broker === brokerLabel);
      console.log('Dispositivo encontrado:', device ? device.name : 'nenhum');
      
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
    
    // 7. Verificar se há algum problema de case-sensitivity ou espaços
    console.log('\nVerificando problemas de case-sensitivity ou espaços nos brokers:');
    const uniqueBrokerValues = [...new Set(devices.map(d => d.broker))];
    console.log('Valores únicos de broker encontrados:', uniqueBrokerValues);
    
    // 8. Verificar se há algum problema de tipo de dados
    console.log('\nVerificando tipos de dados dos brokers:');
    devices.forEach(device => {
      console.log(`${device.name}: broker é do tipo ${typeof device.broker}`);
    });
    
    console.log('=== FIM DA DEPURAÇÃO DE COMUNICAÇÃO DE BROKERS ===');
    
  } catch (error) {
    console.error('Erro durante a depuração:', error);
  }
}

export default debugBrokerCommunication;