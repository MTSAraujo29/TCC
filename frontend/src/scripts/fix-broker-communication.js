// frontend/src/scripts/fix-broker-communication.js

/**
 * Este script corrige problemas de comunicação com os brokers no frontend
 * 
 * Para usar:
 * 1. Importe este arquivo no DashboardPage.js
 * 2. Chame a função fixBrokerCommunication() no useEffect após fetchDashboardData()
 */

import { API_ENDPOINTS } from '../config/api';

async function fixBrokerCommunication() {
  console.log('=== INICIANDO CORREÇÃO DE COMUNICAÇÃO DE BROKERS ===');
  
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
    
    // 5. Verificar cada dispositivo e corrigir o broker se necessário
    const correctedDevices = devices.map(device => {
      // Se o dispositivo não tem broker definido, atribuir um com base no nome
      if (!device.broker) {
        console.log(`Corrigindo broker para dispositivo: ${device.name}`);
        
        // Lógica para atribuir broker com base no nome do dispositivo
        if (device.name.toLowerCase().includes('sala')) {
          device.broker = 'broker1';
        } else if (device.name.toLowerCase().includes('câmera') || 
                  device.name.toLowerCase().includes('camera')) {
          device.broker = 'broker2';
        } else {
          // Padrão para outros dispositivos
          device.broker = 'broker1';
        }
        
        console.log(`✅ Broker atribuído: ${device.broker}`);
      }
      
      return device;
    });
    
    // 6. Atualizar o localStorage com os dispositivos corrigidos
    localStorage.setItem('correctedDevices', JSON.stringify(correctedDevices));
    console.log('Dispositivos corrigidos salvos no localStorage');
    
    // 7. Função para usar os dispositivos corrigidos
    window.getTotalEnergyByBrokerFixed = function(devices, brokerLabel) {
      // Primeiro tenta usar os dispositivos passados como parâmetro
      let device = devices.find(d => d.broker === brokerLabel);
      
      // Se não encontrar, tenta usar os dispositivos corrigidos do localStorage
      if (!device) {
        const correctedDevices = JSON.parse(localStorage.getItem('correctedDevices') || '[]');
        device = correctedDevices.find(d => d.broker === brokerLabel);
        console.log(`Usando dispositivo corrigido para broker ${brokerLabel}:`, device);
      }
      
      return device &&
        device.latestReading &&
        typeof device.latestReading.totalEnergy === "number"
        ? device.latestReading.totalEnergy
        : 0;
    };
    
    console.log('=== FIM DA CORREÇÃO DE COMUNICAÇÃO DE BROKERS ===');
    
  } catch (error) {
    console.error('Erro durante a correção:', error);
  }
}

export default fixBrokerCommunication;