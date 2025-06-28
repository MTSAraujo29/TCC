// Configuração centralizada para URLs da API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
    LOGIN: `${API_BASE_URL}/api/login`,
    REGISTER: `${API_BASE_URL}/api/register`,
    TASMOTA: `${API_BASE_URL}/api/tasmota`,
    DASHBOARD: `${API_BASE_URL}/api/dashboard`,
    HEALTH: `${API_BASE_URL}/health`
};

export default API_BASE_URL;