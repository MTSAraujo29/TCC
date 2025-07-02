// Configuração centralizada para API usando axios
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://tcc-ft7k.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor para adicionar o token JWT automaticamente
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;