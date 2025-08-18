// Configuração centralizada para URLs da API
const API_BASE_URL =
  process.env.REACT_APP_API_URL || "https://tcc-ft7k.onrender.com";

export const API_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/api/login`,
  REGISTER: `${API_BASE_URL}/api/register`,
  TASMOTA: `${API_BASE_URL}/api/tasmota`,
  DASHBOARD: `${API_BASE_URL}/api/dashboard`,
  HEALTH: `${API_BASE_URL}/health`,
  ACCOUNT: `${API_BASE_URL}/api/account`,
  TOTAL_ENERGY_LIVE: `${API_BASE_URL}/api/tasmota/devices/DEVICE_ID/total-energy-live`,
  DASHBOARD_CHART_DAILY_YESTERDAY: `${API_BASE_URL}/api/dashboard/chart/daily-energy-yesterday`,
  DASHBOARD_CHART_WEEKLY_YESTERDAY: `${API_BASE_URL}/api/dashboard/chart/weekly-energy-yesterday`,
  DASHBOARD_CHART_MONTHLY_ENERGY_DATA: `${API_BASE_URL}/api/dashboard/chart/monthly-energy-data`,
  ESTIMATED_BILL: `${API_BASE_URL}/api/dashboard/estimated-bill`,
};

export default API_BASE_URL;
