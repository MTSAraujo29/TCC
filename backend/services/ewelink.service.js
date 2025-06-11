// services/ewelink.service.js
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EWELINK_CLIENT_ID = process.env.EWE_CLIENT_ID;
const EWELINK_CLIENT_SECRET = process.env.EWE_CLIENT_SECRET;
const EWELINK_REDIRECT_URI = process.env.EWE_REDIRECT_URI;
// A URL de autorização será lida diretamente do seu .env
const EWE_AUTHORIZE_URL_FROM_ENV = process.env.EWE_AUTHORIZE_URL; // <--- Esta linha lê do .env
const EWELINK_TOKEN_URL = process.env.EWE_TOKEN_URL;
const EWELINK_REFRESH_TOKEN_URL = process.env.EWE_REFRESH_TOKEN_URL;
const EWELINK_REGION = process.env.EWELINK_REGION || 'us'; // Padrão para 'us' se não estiver definido

// Mapeamento de regiões para URLs DE API (para buscar dispositivos, controlar, etc.)
const EWELINK_API_URLS = {
    us: {
        api: 'https://us-api.coolkit.cc',
    },
    eu: {
        api: 'https://eu-api.coolkit.cc',
    },
    cn: {
        api: 'https://cn-api.coolkit.cn',
    },
    as: {
        api: 'https://as-api.coolkit.cc',
    },
    // Adicione outras regiões conforme a eWeLink suportar
};

class EwelinkService {
    constructor() {
        if (!EWELINK_CLIENT_ID || !EWELINK_CLIENT_SECRET || !EWELINK_REDIRECT_URI || !EWE_AUTHORIZE_URL_FROM_ENV || !EWELINK_TOKEN_URL || !EWELINK_REFRESH_TOKEN_URL) {
            throw new Error('Ewelink credentials (client_id, client_secret, redirect_uri, authorize_url, token_url, refresh_token_url) must be set in environment variables.');
        }
    }

    /**
     * Gera a URL de autorização para o usuário ser redirecionado para a eWeLink.
     * Agora usa a URL definida no .env (EWE_AUTHORIZE_URL).
     * @param {number} userId O ID do usuário logado no seu sistema para ser incluído no 'state'.
     * @returns {{url: string, state: string}} Objeto contendo a URL de autorização e o estado para validação CSRF.
     */
    getAuthorizationUrl(userId) {
        const state = `${userId}_${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}`;

        // Usar a URL do .env para a autorização
        const authUrl = `${EWE_AUTHORIZE_URL_FROM_ENV}?response_type=code&client_id=${EWELINK_CLIENT_ID}&redirect_uri=${encodeURIComponent(EWELINK_REDIRECT_URI)}&state=${state}&scope=user.info,device.all`;
        console.log(`EwelinkService: URL de autorização eWeLink gerada: ${authUrl}`);
        return { url: authUrl, state };
    }

    /**
     * Troca o código de autorização recebido da eWeLink por tokens de acesso e refresh.
     * @param {string} code O código de autorização recebido no callback.
     * @returns {Promise<object>} Um objeto contendo access_token, refresh_token, expires_in, etc.
     */
    async exchangeCodeForTokens(code) {
        try {
            console.log(`EwelinkService: Trocando código por tokens na URL: ${EWELINK_TOKEN_URL}`);
            const response = await axios.post(EWELINK_TOKEN_URL, null, {
                params: {
                    grant_type: 'authorization_code',
                    code: code,
                    client_id: EWELINK_CLIENT_ID,
                    client_secret: EWELINK_CLIENT_SECRET,
                    redirect_uri: EWELINK_REDIRECT_URI,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            return response.data; // Retorna { access_token, refresh_token, expires_in, region }
        } catch (error) {
            console.error('EwelinkService: Erro ao trocar código por tokens:', error.response ? error.response.data : error.message);
            throw new Error(`Falha ao trocar código por tokens: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        }
    }

    /**
     * Refresca o token de acesso da eWeLink usando o token de refresh.
     * @param {string} refreshToken O token de refresh.
     * @returns {Promise<object>} Um objeto contendo novos access_token, refresh_token, expires_in, etc.
     */
    async refreshAccessToken(refreshToken) {
        try {
            console.log(`EwelinkService: Refrescando token na URL: ${EWELINK_REFRESH_TOKEN_URL}`);
            const response = await axios.post(EWELINK_REFRESH_TOKEN_URL, null, {
                params: {
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: EWELINK_CLIENT_ID,
                    client_secret: EWELINK_CLIENT_SECRET,
                    redirect_uri: EWELINK_REDIRECT_URI,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            return response.data; // Retorna { access_token, refresh_token, expires_in, region }
        } catch (error) {
            console.error('EwelinkService: Erro ao refrescar token:', error.response ? error.response.data : error.message);
            throw new Error(`Falha ao refrescar token de acesso: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        }
    }

    /**
     * Busca os tokens e a região da eWeLink do usuário no banco de dados e os atualiza se necessário.
     * @param {number} userId O ID do usuário no seu sistema.
     * @returns {Promise<{accessToken: string, refreshToken: string, region: string}>} Tokens e região da eWeLink.
     */
    async getAndUpdateEwelinkTokens(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { ewelinkAccessToken: true, ewelinkRefreshToken: true, ewelinkRegion: true, ewelinkTokenExpiresAt: true }
        });

        if (!user || !user.ewelinkAccessToken || !user.ewelinkRefreshToken || !user.ewelinkRegion) {
            return null; // Usuário não conectado à eWeLink ou faltando dados
        }

        // Verifica se o token expirou ou está próximo de expirar (ex: em 5 minutos)
        if (user.ewelinkTokenExpiresAt && user.ewelinkTokenExpiresAt.getTime() < Date.now() + (5 * 60 * 1000)) {
            console.log(`EwelinkService: Access token para userId ${userId} expirado ou próximo de expirar. Tentando refrescar.`);
            try {
                const newTokens = await this.refreshAccessToken(user.ewelinkRefreshToken);
                // Atualiza o banco de dados com os novos tokens
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        ewelinkAccessToken: newTokens.access_token,
                        ewelinkRefreshToken: newTokens.refresh_token || user.ewelinkRefreshToken,
                        ewelinkRegion: newTokens.region || user.ewelinkRegion,
                        ewelinkTokenExpiresAt: new Date(Date.now() + (newTokens.expires_in * 1000))
                    }
                });
                return {
                    accessToken: newTokens.access_token,
                    refreshToken: newTokens.refresh_token || user.ewelinkRefreshToken,
                    region: newTokens.region || user.ewelinkRegion
                };
            } catch (refreshError) {
                console.error(`EwelinkService: Falha ao refrescar token para userId ${userId}:`, refreshError.message);
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        ewelinkAccessToken: null,
                        ewelinkRefreshToken: null,
                        ewelinkRegion: null,
                        ewelinkTokenExpiresAt: null
                    }
                });
                throw new Error('Sua sessão eWeLink expirou e não pôde ser renovada. Por favor, reconecte sua conta eWeLink.');
            }
        }

        return {
            accessToken: user.ewelinkAccessToken,
            refreshToken: user.ewelinkRefreshToken,
            region: user.ewelinkRegion
        };
    }

    /**
     * Busca a lista de dispositivos do usuário na eWeLink.
     * @param {string} accessToken O token de acesso da eWeLink.
     * @param {string} region A região do usuário na eWeLink (ex: 'us', 'eu').
     * @returns {Promise<Array>} Um array de objetos representando os dispositivos.
     */
    async getEwelinkDevices(accessToken, region) {
        const apiBaseUrl = EWELINK_API_URLS[region]?.api;
        if (!apiBaseUrl) {
            throw new Error(`Unsupported eWeLink region for API calls: ${region}`);
        }

        try {
            console.log(`EwelinkService: Buscando dispositivos na URL: ${apiBaseUrl}/v2/device/thing`);
            const response = await axios.get(`${apiBaseUrl}/v2/device/thing`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data.data;
        } catch (error) {
            console.error('EwelinkService: Erro ao buscar dispositivos eWeLink:', error.response ? error.response.data : error.message);
            throw new Error(`Falha ao buscar dispositivos eWeLink: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        }
    }

    /**
     * Controla um dispositivo eWeLink (ligar/desligar).
     * @param {string} accessToken O token de acesso da eWeLink.
     * @param {string} region A região do usuário na eWeLink.
     * @param {string} deviceId O ID do dispositivo eWeLink.
     * @param {object} params Os parâmetros de controle (ex: { switch: 'on' } ou { switch: 'off' }).
     * @returns {Promise<object>} O resultado da operação de controle.
     */
    async controlEwelinkDevice(accessToken, region, deviceId, params) {
        const apiBaseUrl = EWELINK_API_URLS[region]?.api;
        if (!apiBaseUrl) {
            throw new Error(`Unsupported eWeLink region for API calls: ${region}`);
        }

        try {
            console.log(`EwelinkService: Controlando dispositivo ${deviceId} com parâmetros: ${JSON.stringify(params)} na URL: ${apiBaseUrl}/v2/device/thing/status`);
            const response = await axios.post(`${apiBaseUrl}/v2/device/thing/status`, {
                deviceid: deviceId,
                params: params,
            }, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            return response.data;
        } catch (error) {
            console.error('EwelinkService: Erro ao controlar dispositivo eWeLink:', error.response ? error.response.data : error.message);
            throw new Error(`Falha ao controlar dispositivo eWeLink: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
        }
    }
}

module.exports = new EwelinkService();