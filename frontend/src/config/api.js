/**
 * Configuração Central da API
 * 
 * Define URLs base e endpoints para comunicação com o backend.
 * Suporta configuração dinâmica via variáveis de ambiente para
 * diferentes ambientes (desenvolvimento/produção).
 * 
 * @module APIConfig
 */

// === CONFIGURAÇÃO BASE ===
// URL do backend - usa variável de ambiente ou fallback para produção
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://tcc-ft7k.onrender.com';

// === ENDPOINTS DA API ===
// Centralização de todos os endpoints para facilitar manutenção
export const API_ENDPOINTS = {
    // Autenticação
    LOGIN: `${API_BASE_URL}/api/login`,
    REGISTER: `${API_BASE_URL}/api/register`,
    
    // Gerenciamento de conta
    ACCOUNT: `${API_BASE_URL}/api/account`,
    
    // Dispositivos Tasmota
    TASMOTA: `${API_BASE_URL}/api/tasmota`,
    
    // Dashboard e métricas
    DASHBOARD: `${API_BASE_URL}/api/dashboard`,
    
    // Monitoramento do sistema
    HEALTH: `${API_BASE_URL}/health`,
    
    // Energia total em tempo real (template com DEVICE_ID)
    TOTAL_ENERGY_LIVE: `${API_BASE_URL}/api/tasmota/devices/DEVICE_ID/total-energy-live`
};

// Exportação padrão da URL base para compatibilidade
export default API_BASE_URL;