// backend/services/scheduledTasks.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const aiPredictionService = require('./aiPrediction.service');

/**
 * Serviço para gerenciar tarefas agendadas do sistema
 * Inclui treinamento periódico do modelo de IA e geração de previsões
 */
class ScheduledTasksService {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Inicializa as tarefas agendadas
   */
  initialize() {
    if (this.isInitialized) return;
    
    console.log('[SCHEDULED-TASKS] Inicializando tarefas agendadas...');
    
    // Agenda o treinamento mensal do modelo de IA (executa no primeiro dia de cada mês às 3:00 AM)
    this.scheduleMonthlyTraining();
    
    // Agenda a geração de previsões mensais (executa no segundo dia de cada mês às 4:00 AM)
    this.scheduleMonthlyPredictions();
    
    this.isInitialized = true;
    console.log('[SCHEDULED-TASKS] Tarefas agendadas inicializadas com sucesso!');
  }

  /**
   * Agenda o treinamento mensal do modelo de IA
   */
  scheduleMonthlyTraining() {
    // Executa no primeiro dia de cada mês às 3:00 AM
    cron.schedule('0 3 1 * *', async () => {
      console.log('[SCHEDULED-TASKS] Iniciando treinamento mensal do modelo de IA...');
      
      try {
        // Busca todos os usuários ativos
        const users = await prisma.user.findMany({
          where: { active: true },
          select: { id: true }
        });
        
        console.log(`[SCHEDULED-TASKS] Treinando modelo para ${users.length} usuários`);
        
        // Para cada usuário, treina o modelo com os dados mais recentes
        for (const user of users) {
          try {
            await aiPredictionService.trainModel(user.id);
            console.log(`[SCHEDULED-TASKS] Modelo treinado com sucesso para usuário ${user.id}`);
          } catch (error) {
            console.error(`[SCHEDULED-TASKS] Erro ao treinar modelo para usuário ${user.id}:`, error);
          }
        }
        
        console.log('[SCHEDULED-TASKS] Treinamento mensal concluído!');
      } catch (error) {
        console.error('[SCHEDULED-TASKS] Erro durante o treinamento mensal:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });
    
    console.log('[SCHEDULED-TASKS] Treinamento mensal agendado para o primeiro dia de cada mês às 3:00 AM');
  }

  /**
   * Agenda a geração de previsões mensais
   */
  scheduleMonthlyPredictions() {
    // Executa no segundo dia de cada mês às 4:00 AM
    cron.schedule('0 4 2 * *', async () => {
      console.log('[SCHEDULED-TASKS] Iniciando geração de previsões mensais...');
      
      try {
        // Busca todos os usuários ativos
        const users = await prisma.user.findMany({
          where: { active: true },
          select: { id: true }
        });
        
        console.log(`[SCHEDULED-TASKS] Gerando previsões para ${users.length} usuários`);
        
        // Para cada usuário, gera uma nova previsão
        for (const user of users) {
          try {
            const result = await aiPredictionService.generatePrediction(user.id);
            if (result.success) {
              console.log(`[SCHEDULED-TASKS] Previsão gerada com sucesso para usuário ${user.id}`);
            } else {
              console.log(`[SCHEDULED-TASKS] Não foi possível gerar previsão para usuário ${user.id}: ${result.message}`);
            }
          } catch (error) {
            console.error(`[SCHEDULED-TASKS] Erro ao gerar previsão para usuário ${user.id}:`, error);
          }
        }
        
        console.log('[SCHEDULED-TASKS] Geração de previsões mensais concluída!');
      } catch (error) {
        console.error('[SCHEDULED-TASKS] Erro durante a geração de previsões mensais:', error);
      }
    }, {
      timezone: 'America/Sao_Paulo'
    });
    
    console.log('[SCHEDULED-TASKS] Geração de previsões mensais agendada para o segundo dia de cada mês às 4:00 AM');
  }
}

module.exports = new ScheduledTasksService();