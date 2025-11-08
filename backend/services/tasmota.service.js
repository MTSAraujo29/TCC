// backend/services/tasmota.service.js

// --- Importações de Módulos ---
const mqtt = require("mqtt"); // Importa a biblioteca principal para comunicação MQTT.
const { PrismaClient } = require("@prisma/client"); // Importa o PrismaClient, o ORM para interagir com o banco de dados.
const energyTotalManager = require("./energyTotalManager"); // Importa nosso serviço customizado que centraliza as regras de negócio e cálculos de energia.

// --- Inicialização de Clientes ---
const prisma = new PrismaClient(); // Cria uma instância global do Prisma para acesso ao banco.

// --- Configurações do Broker MQTT 1 (Principal) ---
// Carrega as variáveis de ambiente (do arquivo .env) para o primeiro broker MQTT.
const MQTT_HOST = process.env.MQTT_HOST;
const MQTT_PORT = process.env.MQTT_PORT || 8883; // Porta padrão 8883 (MQTTs)
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const MQTT_PROTOCOL = process.env.MQTT_PROTOCOL || "mqtts"; // Protocolo 'mqtts' (seguro) por padrão
const MQTT_URL = process.env.MQTT_URL; // URLs completas (podem ser usadas opcionalmente)
const MQTT_WS_URL = process.env.MQTT_WS_URL;

// --- Configurações do MQTT Broker 2 (Secundário) ---
// Carrega as variáveis de ambiente para o segundo broker MQTT.
// Ter dois brokers permite conectar dispositivos em redes ou locais diferentes.
const MQTT_HOST2 = process.env.MQTT_HOST2;
const MQTT_PORT2 = process.env.MQTT_PORT2 || 8883;
const MQTT_USERNAME2 = process.env.MQTT_USERNAME2;
const MQTT_PASSWORD2 = process.env.MQTT_PASSWORD2;
const MQTT_PROTOCOL2 = process.env.MQTT_PROTOCOL2 || "mqtts";
const MQTT_URL2 = process.env.MQTT_TLS_URL2;
const MQTT_WS_URL2 = process.env.MQTT_TLS_WS_URL2;

// --- Tópicos MQTT dos Dispositivos ---
// Lista de todos os tópicos que o backend precisa "ouvir" (subscrever).
// Inclui tópicos de telemetria (SENSOR, STATE) e de status (STATUS, POWER).
const SONOFF_TOPICS = [
  // Dispositivo 1 (conectado ao Broker 1)
  "stat/tasmota_C2BE64/STATUS10",
  "stat/tasmota_C2BE64/STATUS11",
  "stat/tasmota_C2BE64/POWER",
  "tele/tasmota_C2BE64/SENSOR",
  "tele/tasmota_C2BE64/STATE",
  // Dispositivo 2 (conectado ao Broker 2)
  "stat/tasmota_C3B7EC/STATUS10",
  "stat/tasmota_C3B7EC/STATUS11",
  "stat/tasmota_C3B7EC/POWER",
  "tele/tasmota_C3B7EC/SENSOR",
  "tele/tasmota_C3B7EC/STATE",
];

// --- Configurações dos Clientes MQTT ---
// Gera um ID de cliente único para esta instância do backend.
// O sufixo aleatório evita conflitos se o backend for reiniciado rapidamente.
const CLIENT_ID = `backend_tcc_monitor_${Math.random()
  .toString(16)
  .substr(2, 8)}`;

// Objeto de opções de conexão para o Broker 1
const MQTT_OPTIONS = {
  port: MQTT_PORT,
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: CLIENT_ID, // Usa o mesmo Client ID para ambos (brokers diferentes)
  clean: true, // Inicia uma sessão limpa, sem persistir mensagens
  keepalive: 60, // Tempo em segundos para enviar "pings" e manter a conexão viva
  reconnectPeriod: 1000, // Tenta reconectar a cada 1 segundo se a conexão cair
  protocol: MQTT_PROTOCOL,
  rejectUnauthorized: false, // IMPORTANTE: Permite conexões com certificados SSL autoassinados (bom para testes, inseguro para produção)
};

// Objeto de opções de conexão para o Broker 2
const MQTT_OPTIONS2 = {
  port: MQTT_PORT2,
  username: MQTT_USERNAME2,
  password: MQTT_PASSWORD2,
  clientId: CLIENT_ID,
  clean: true,
  keepalive: 60,
  reconnectPeriod: 1000,
  protocol: MQTT_PROTOCOL2,
  rejectUnauthorized: false, // Mesma observação de segurança do Broker 1
};

// --- Variáveis de Estado e Controle ---
let mqttClient = null; // Armazena a instância do cliente conectado ao Broker 1
let mqttClient2 = null; // Armazena a instância do cliente conectado ao Broker 2
let mqttClientInitCount = 0; // Contador para depuração (quantas vezes tentamos iniciar o Cliente 1)
let mqttClient2InitCount = 0; // Contador para depuração (quantas vezes tentamos iniciar o Cliente 2)
let mqttClientInactivityTimer = null; // Temporizador para desconectar o Cliente 1 por inatividade
let mqttClient2InactivityTimer = null; // Temporizador para desconectar o Cliente 2 por inatividade
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // Define o tempo limite: 5 minutos

// --- Cache em Memória ---
// Guarda o último valor de energia total (kWh) recebido de cada dispositivo.
// Isso é crucial para o 'energyTotalManager' calcular o consumo parcial.
const lastTotalEnergyCache = {};

// Função auxiliar para ATUALIZAR o valor de energia total no cache
function updateTotalEnergyCache(deviceId, valor) {
  lastTotalEnergyCache[deviceId] = valor;
}

// Função auxiliar para LER o valor de energia total do cache
function getTotalEnergyFromCache(deviceId) {
  return lastTotalEnergyCache[deviceId] || null; // Retorna o valor ou nulo se não existir
}

// --- Gerenciador de Inatividade ---
// Esta função reinicia o "cronômetro" de inatividade.
// Se um cliente ficar 5 minutos sem enviar ou receber NADA, ele será desconectado
// para economizar recursos e forçar uma reconexão limpa se necessário.
function resetMqttClientInactivityTimer(client, clientName) {
  if (clientName === "mqttClient") {
    if (mqttClientInactivityTimer) clearTimeout(mqttClientInactivityTimer); // Limpa o timer antigo
    // Cria um novo timer
    mqttClientInactivityTimer = setTimeout(() => {
      console.warn(
        `[MQTT] ${clientName} inativo por mais de 5 minutos. Desconectando...`
      );
      client.end(true); // Força a desconexão
    }, INACTIVITY_TIMEOUT_MS);
  } else if (clientName === "mqttClient2") {
    if (mqttClient2InactivityTimer) clearTimeout(mqttClient2InactivityTimer); // Limpa o timer antigo
    // Cria um novo timer
    mqttClient2InactivityTimer = setTimeout(() => {
      console.warn(
        `[MQTT] ${clientName} inativo por mais de 5 minutos. Desconectando...`
      );
      client.end(true); // Força a desconexão
    }, INACTIVITY_TIMEOUT_MS);
  }
}

// --- Funções Principais do Serviço ---

/**
 * Inicializa AMBOS os clientes MQTT.
 * Esta função é "idemponente": ela só tenta conectar se o cliente ainda não estiver conectado.
 */
async function initializeMqttClients() {
  // --- Lógica para o Broker 1 ---
  if (!mqttClient) { // Só executa se o cliente 1 não estiver inicializado
    mqttClientInitCount++;
    console.log(
      `[MQTT] Inicializando conexão MQTT 1 (vezes inicializado: ${mqttClientInitCount})`
    );
    console.log(
      `Tentando conectar ao broker MQTT 1: ${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`
    );
    // Efetivamente inicia a conexão
    mqttClient = mqtt.connect(
      `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`,
      MQTT_OPTIONS
    );

    // --- Definição de "Listeners" de Eventos para o Cliente 1 ---

    // Evento: 'connect' (disparado quando a conexão é bem-sucedida)
    mqttClient.on("connect", () => {
      console.log("Conectado ao broker MQTT 1!");
      // Filtra APENAS os tópicos do Dispositivo 1 (C2BE64) e se inscreve neles
      SONOFF_TOPICS.filter((t) => t.includes("C2BE64")).forEach((topic) => {
        mqttClient.subscribe(topic, (err) => {
          if (!err) {
            console.log(`[Broker1] Inscrito no tópico: ${topic}`);
          } else {
            console.error(
              `[Broker1] Erro ao se inscrever no tópico ${topic}:`,
              err
            );
          }
        });
      });
      // Inicia o timer de inatividade assim que conecta
      resetMqttClientInactivityTimer(mqttClient, "mqttClient");
    });

    // Evento: 'message' (disparado quando uma mensagem chega de um tópico inscrito)
    mqttClient.on("message", (topic, message) => {
      resetMqttClientInactivityTimer(mqttClient, "mqttClient"); // Qualquer mensagem reinicia o timer
      handleMqttMessage(topic, message, "broker1"); // Chama a função central para processar a mensagem
    });

    // Evento: 'packetsend' (disparado quando NÓS enviamos um pacote, ex: um comando)
    mqttClient.on("packetsend", () => {
      resetMqttClientInactivityTimer(mqttClient, "mqttClient"); // Também reinicia o timer
    });

    // Eventos de 'close' (desconexão) e 'error' (erro)
    mqttClient.on("close", () => {
      console.warn("[MQTT] Conexão MQTT 1 fechada!");
    });
    mqttClient.on("error", (err) => {
      console.error("[MQTT] Erro na conexão MQTT 1:", err);
    });
  } else {
    console.log(
      "[MQTT] mqttClient já inicializado, reutilizando conexão existente."
    );
  }

  // --- Lógica para o Broker 2 ---
  // O bloco abaixo é IDÊNTICO ao do Broker 1, mas para as variáveis do mqttClient2
  // e filtrando os tópicos do Dispositivo 2 (C3B7EC).
  if (!mqttClient2) {
    mqttClient2InitCount++;
    console.log(
      `[MQTT] Inicializando conexão MQTT 2 (vezes inicializado: ${mqttClient2InitCount})`
    );
    console.log(
      `Tentando conectar ao broker MQTT 2: ${MQTT_PROTOCOL2}://${MQTT_HOST2}:${MQTT_PORT2}`
    );
    mqttClient2 = mqtt.connect(
      `${MQTT_PROTOCOL2}://${MQTT_HOST2}:${MQTT_PORT2}`,
      MQTT_OPTIONS2
    );

    mqttClient2.on("connect", () => {
      console.log("Conectado ao broker MQTT 2!");
      SONOFF_TOPICS.filter((t) => t.includes("C3B7EC")).forEach((topic) => {
        mqttClient2.subscribe(topic, (err) => {
          if (!err) {
            console.log(`[Broker2] Inscrito no tópico: ${topic}`);
          } else {
            console.error(
              `[Broker2] Erro ao se inscrever no tópico ${topic}:`,
              err
            );
          }
        });
      });
      resetMqttClientInactivityTimer(mqttClient2, "mqttClient2");
    });

    mqttClient2.on("message", (topic, message) => {
      resetMqttClientInactivityTimer(mqttClient2, "mqttClient2");
      handleMqttMessage(topic, message, "broker2");
    });

    mqttClient2.on("packetsend", () => {
      resetMqttClientInactivityTimer(mqttClient2, "mqttClient2");
    });

    mqttClient2.on("close", () => {
      console.warn("[MQTT] Conexão MQTT 2 fechada!");
    });

    mqttClient2.on("error", (err) => {
      console.error("[MQTT] Erro na conexão MQTT 2:", err);
    });
  } else {
    console.log(
      "[MQTT] mqttClient2 já inicializado, reutilizando conexão existente."
    );
  }
}

/**
 * Função CENTRALIZADA para processar todas as mensagens MQTT recebidas.
 * Ela identifica o tópico, extrai os dados e decide o que fazer com eles.
 * @param {string} topic - O tópico do qual a mensagem veio (ex: "tele/tasmota_C2BE64/SENSOR")
 * @param {Buffer} message - O conteúdo da mensagem (geralmente um JSON em formato Buffer)
 * @param {string} broker - Identificador ("broker1" ou "broker2") para sabermos de onde veio
 */
async function handleMqttMessage(topic, message, broker) {
  const payload = message.toString(); // Converte a mensagem de Buffer para String (JSON)
  try {
    // --- Lógica para Tópicos de Energia (STATUS10 e SENSOR) ---
    // Estes tópicos contêm dados de potência, tensão, corrente, energia total, etc.
    // STATUS10: Geralmente vem como resposta a um comando.
    // SENSOR: Vem periodicamente (telemetria).

    if (topic.endsWith("STATUS10")) {
      const data = JSON.parse(payload); // Converte o JSON (string) para um objeto JS
      const tasmotaTopic = topic.split("/")[1]; // Extrai o ID do dispositivo (ex: "tasmota_C2BE64")

      // Busca o dispositivo no banco de dados usando seu ID (tasmotaTopic)
      const device = await prisma.device.findUnique({
        where: { tasmotaTopic },
      });

      // Se o dispositivo não estiver cadastrado no banco, ignora a mensagem.
      if (!device) {
        console.warn(
          `[${broker}] Dispositivo com tasmotaTopic "${tasmotaTopic}" não encontrado no banco de dados. Pulando salvamento.`
        );
        return;
      }
      // Validação: Garante que o dispositivo C2BE64 (broker1) só seja processado se a msg veio do broker1.
      if (device.broker !== broker) {
        console.warn(
          `[${broker}] Dispositivo encontrado, mas broker não bate. Esperado: ${device.broker}`
        );
        return;
      }

      // Verifica se a estrutura de dados esperada (StatusSNS.ENERGY) existe no JSON
      if (data.StatusSNS && data.StatusSNS.ENERGY) {
        const energy = data.StatusSNS.ENERGY; // Pega o objeto de energia
        
        // Atualiza o cache em memória com o valor de Energia Total (kWh)
        updateTotalEnergyCache(device.id, energy.Total);

        // Envia os dados brutos para o 'energyTotalManager' para cálculos
        // (ex: calcular o consumo parcial desde a última leitura)
        const processedData = await energyTotalManager.processEnergyData(
          {
            power: energy.Power,
            voltage: energy.Voltage,
            current: energy.Current,
            totalEnergy: energy.Total, // kWh total acumulado no dispositivo
            EnergyToday: energy.Today,
            EnergyYesterday: energy.Yesterday,
            ApparentPower: energy.ApparentPower,
            ReactivePower: energy.ReactivePower,
            PowerFactor: energy.Factor,
            timestamp: new Date(), // Adiciona a data/hora atual
          },
          device.id, // ID do dispositivo no nosso banco
          tasmotaTopic
        );

        // SALVA a leitura de energia processada no banco de dados
        const leituraSalva = await prisma.energyReading.create({
          data: {
            ...processedData, // Inclui todos os dados processados
            brokerLabel: broker, // Salva qual broker enviou (para depuração)
          },
        });
      }
    }

    // --- Lógica para Tópicos de Status (Ligado/Desligado) ---
    // STATUS11, STATE, e POWER informam se o relé está "ON" ou "OFF".

    // Tópico: STATUS11 (Resposta a comando de status)
    if (topic.endsWith("STATUS11")) {
      const data = JSON.parse(payload);
      const tasmotaTopic = topic.split("/")[1];
      const device = await prisma.device.findUnique({
        where: { tasmotaTopic },
      });
      if (!device) return; // Ignora se não achar o dispositivo
      if (device.broker !== broker) return; // Ignora se o broker estiver errado

      // Verifica se a informação de "POWER" existe
      if (data.StatusSTS && typeof data.StatusSTS.POWER !== "undefined") {
        const isOn = data.StatusSTS.POWER === "ON"; // Converte "ON" (string) para true (boolean)
        
        // ATUALIZA o campo 'powerState' do dispositivo no banco de dados
        await prisma.device.update({
          where: { id: device.id },
          data: { powerState: isOn },
        });
      }
    }

    // Tópico: SENSOR (Telemetria periódica)
    // O Tasmota também envia dados de energia no tópico SENSOR.
    if (topic.endsWith("SENSOR")) {
      const data = JSON.parse(payload);
      const tasmotaTopic = topic.split("/")[1];
      const device = await prisma.device.findUnique({
        where: { tasmotaTopic },
      });
      if (!device) return;
      if (device.broker !== broker) {
        return;
      }

      // A estrutura do SENSOR é um pouco diferente do STATUS10 (não tem 'StatusSNS')
      if (data.ENERGY) {
        // A lógica de processamento e salvamento é IDÊNTICA à do STATUS10
        updateTotalEnergyCache(device.id, data.ENERGY.Total);
        const processedData = await energyTotalManager.processEnergyData(
          {
            power: data.ENERGY.Power,
            voltage: data.ENERGY.Voltage,
            current: data.ENERGY.Current,
            totalEnergy: data.ENERGY.Total,
            EnergyToday: data.ENERGY.Today,
            EnergyYesterday: data.ENERGY.Yesterday,
            ApparentPower: data.ENERGY.ApparentPower,
            ReactivePower: data.ENERGY.ReactivePower,
            PowerFactor: data.ENERGY.Factor,
            timestamp: new Date(),
          },
          device.id,
          tasmotaTopic
        );

        // Salva no banco
        const leituraSalva = await prisma.energyReading.create({
          data: {
            ...processedData,
            brokerLabel: broker,
          },
        });
      }
    }

    // Tópico: STATE (Telemetria periódica de status)
    if (topic.endsWith("STATE")) {
      const data = JSON.parse(payload);
      const tasmotaTopic = topic.split("/")[1];
      const device = await prisma.device.findUnique({
        where: { tasmotaTopic },
      });
      if (!device) return;
      if (device.broker !== broker) {
        return;
      }

      // Verifica o campo "POWER" (assim como no STATUS11)
      if (typeof data.POWER !== "undefined") {
        const isOn = data.POWER === "ON";
        // Atualiza o estado no banco
        await prisma.device.update({
          where: { id: device.id },
          data: { powerState: isOn },
        });
      }
    }

    // Tópico: POWER (Publicado imediatamente quando o relé muda)
    // Este é o tópico mais rápido para saber o status (ON/OFF).
    if (topic.endsWith("POWER")) {
      const tasmotaTopic = topic.split("/")[1];
      const device = await prisma.device.findUnique({
        where: { tasmotaTopic },
      });
      if (!device) return;
      if (device.broker !== broker) {
        return;
      }
      
      // O payload aqui não é JSON, é apenas a string "ON" ou "OFF"
      const isOn = payload === "ON"; 
      // Atualiza o estado no banco
      await prisma.device.update({
        where: { id: device.id },
        data: { powerState: isOn },
      });
    }
  } catch (error) {
    // Bloco TRY/CATCH: Se der erro ao processar UMA mensagem (ex: JSON mal formado),
    // o serviço apenas loga o erro e continua rodando, sem "quebrar".
    console.error(
      `[${broker}] Erro ao processar ou salvar mensagem MQTT:`,
      error
    );
    console.log("Mensagem original que causou o erro:", payload);
  }
}

/**
 * Função para ENVIAR comandos (publicar) para os dispositivos.
 * Ex: Ligar/Desligar o relé.
 * @param {string} topic - O tópico de comando (ex: "cmnd/tasmota_C2BE64/POWER")
 * @param {string} message - A mensagem (ex: "ON", "OFF", "TOGGLE")
 * @param {string} broker - Qual broker ("broker1" ou "broker2") deve enviar o comando
 */
async function publishMqttCommand(topic, message, broker) {
  // Roteamento: Verifica para qual broker o comando deve ir
  if (broker === "broker2") {
    // Garante que o cliente 2 esteja conectado antes de tentar publicar
    if (!mqttClient2) await initializeMqttClients();
    
    // Usa uma Promise para que a função que chamou saiba se o comando foi enviado
    return new Promise((resolve, reject) => {
      mqttClient2.publish(topic, message, (err) => { // Publica (envia) a mensagem
        if (err) {
          console.error("[Broker2] Erro ao publicar comando MQTT:", err);
          reject(err);
        } else {
          console.log(
            `[Broker2] Comando MQTT publicado: ${topic} -> ${message}`
          );
          resolve();
        }
      });
    });
  } else {
    // Lógica idêntica para o Broker 1 (padrão)
    if (!mqttClient) await initializeMqttClients();
    return new Promise((resolve, reject) => {
      mqttClient.publish(topic, message, (err) => {
        if (err) {
          console.error("[Broker1] Erro ao publicar comando MQTT:", err);
          reject(err);
        } else {
          console.log(
            `[Broker1] Comando MQTT publicado: ${topic} -> ${message}`
          );
          resolve();
        }
      });
    });
  }
}

// --- Re-exportação de Funções ---
// "Puxa" as funções do 'energyTotalManager' e as exporta a partir deste módulo.
// Isso centraliza o acesso: outros módulos (como controllers) podem importar
// tudo relacionado a energia e Tasmota apenas deste arquivo.
const isLastDayOfMonth = energyTotalManager.isLastDayOfMonth;
const isPenultimateDayOfMonth = energyTotalManager.isPenultimateDayOfMonth;
const calculateMonthlyConsumption =
  energyTotalManager.calculateMonthlyConsumption;

// --- Exportações do Módulo ---
// Expõe as funções que precisam ser acessadas por outras partes do backend.
module.exports = {
  // Funções principais deste serviço
  initializeMqttClients, // Para ser chamada quando o servidor iniciar
  publishMqttCommand, // Para os controllers poderem enviar comandos
  getTotalEnergyFromCache, // Para os controllers obterem o último valor de kWh

  // Funções "re-exportadas" do energyTotalManager
  isLastDayOfMonth,
  isPenultimateDayOfMonth,
  calculateMonthlyConsumption,
  processEnergyData: energyTotalManager.processEnergyData,
  processMonthlyConsumptionCalculation:
    energyTotalManager.processMonthlyConsumptionCalculation,
  getCurrentTotalEnergyForDisplay:
    energyTotalManager.getCurrentTotalEnergyForDisplay,
  getAccumulatedTotalEnergy: energyTotalManager.getAccumulatedTotalEnergy,
  getCurrentMonthlyConsumption: energyTotalManager.getCurrentMonthlyConsumption,
  getMonthlyConsumptionHistory: energyTotalManager.getMonthlyConsumptionHistory,
  calculateEstimatedBill: energyTotalManager.calculateEstimatedBill,
  testBillCalculation: energyTotalManager.testBillCalculation,
};