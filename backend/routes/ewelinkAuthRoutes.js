// backend/routes/ewelinkAuthRoutes.js

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken'); // Para decodificar o JWT do seu sistema e obter o userId

const prisma = new PrismaClient();

// Carregar variáveis de ambiente do .env
// Ajuste o caminho conforme a localização do seu arquivo .env
require('dotenv').config({ path: '../../.env' });

// Credenciais da eWeLink (obtidas do console de desenvolvedor da eWeLink)
const EWE_CLIENT_ID = process.env.EWE_CLIENT_ID;
const EWE_CLIENT_SECRET = process.env.EWE_CLIENT_SECRET;
const EWE_REDIRECT_URI = process.env.EWE_REDIRECT_URI; // Ex: http://localhost:5000/api/ewelink/callback
const EWE_AUTHORIZE_URL = process.env.EWE_AUTHORIZE_URL || 'https://eu-api.coolkit.cc/v2/user/oauth/authorize';
const EWE_TOKEN_URL = process.env.EWE_TOKEN_URL || 'https://eu-api.coolkit.cc/v2/user/oauth/token';
const EWE_REFRESH_TOKEN_URL = process.env.EWE_REFRESH_TOKEN_URL || 'https://eu-api.coolkit.cc/v2/user/oauth/refreshToken';

// Endpoint base para a API eWeLink (será ajustado pela região)
// A eWeLink usa diferentes endpoints de API base dependendo da região (ex: eu-api.coolkit.cc, us-api.coolkit.cc)
// A URL base da API geralmente tem o formato `https://${region}-api.coolkit.cc/v2`
// Você precisará da região do usuário para usar a API corretamente.

// Verificação de variáveis de ambiente
if (!EWE_CLIENT_ID || !EWE_CLIENT_SECRET || !EWE_REDIRECT_URI) {
    console.error('ERRO: As variáveis de ambiente EWE_CLIENT_ID, EWE_CLIENT_SECRET, ou EWE_REDIRECT_URI não estão definidas.');
    // Considere lançar um erro ou sair do processo em um ambiente de produção
}

// Middleware de Autenticação JWT (COLOQUE ESTE AQUI TAMBÉM SE SEPARADO DO SERVER.JS)
// Se você já tem esse middleware no server.js e está passando req.user, pode pular isso aqui
// Mas é uma boa prática tê-lo onde você precisa proteger as rotas.
const JWT_SECRET = process.env.JWT_SECRET;

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }
        req.user = user; // Adiciona as informações do usuário logado do seu sistema
        next();
    });
}


/**
 * @route GET /api/ewelink/authorize
 * @desc Inicia o fluxo OAuth 2.0 da eWeLink.
 * O usuário do SEU sistema (logado) será redirecionado para a página de autorização da eWeLink.
 * Esta rota deve ser chamada pelo seu frontend, talvez através de um botão "Conectar eWeLink".
 */
router.get('/authorize', authenticateToken, (req, res) => {
    const state = `${req.user.userId}_${Math.random().toString(36).substring(2, 15)}`;
    const authUrl = `${EWE_AUTHORIZE_URL}?` +
        `response_type=code&` +
        `client_id=${EWE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(EWE_REDIRECT_URI)}&` +
        `scope=user.info,device.all&` +
        `state=${state}`;
    console.log(`URL de autorização eWeLink gerada: ${authUrl}`);
    res.json({ url: authUrl }); // Retorna a URL como JSON
});

/**
 * @route GET /api/ewelink/callback
 * @desc Endpoint de callback para onde a eWeLink redireciona após a autorização do usuário.
 * Aqui, trocamos o 'code' por 'access_token' e 'refresh_token'.
 */
router.get('/callback', async(req, res) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
        console.error('Erro na autorização eWeLink:', error_description || error);
        // Em um cenário real, você redirecionaria para uma página de erro no frontend
        return res.status(400).send(`Erro na autorização eWeLink: ${error_description || error}`);
    }

    // TODO: VERIFIQUE AQUI O PARÂMETRO 'state' para prevenir ataques CSRF!
    // Ele deve corresponder ao 'state' que você enviou na rota /authorize.
    const [userIdFromState, randomString] = state.split('_');
    const userId = parseInt(userIdFromState, 10); // Converte de volta para número

    if (isNaN(userId)) {
        console.error('State inválido ou userId não encontrado no state.');
        return res.status(403).send('Erro de segurança: State inválido.');
    }

    try {
        console.log(`Recebido code: ${code}, state: ${state} da eWeLink. Trocando por tokens...`);

        const tokenResponse = await axios.post(EWE_TOKEN_URL, null, {
            params: {
                grant_type: 'authorization_code',
                code: code,
                client_id: EWE_CLIENT_ID,
                client_secret: EWE_CLIENT_SECRET,
                redirect_uri: EWE_REDIRECT_URI
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in, region } = tokenResponse.data;

        console.log(`Tokens eWeLink obtidos para userId: ${userId}`);

        // Salva os tokens no banco de dados para o usuário correspondente
        await prisma.user.update({
            where: { id: userId },
            data: {
                ewelinkAccessToken: access_token,
                ewelinkRefreshToken: refresh_token,
                ewelinkRegion: region,
                ewelinkTokenExpiresAt: new Date(Date.now() + (expires_in * 1000)) // expires_in está em segundos
            }
        });

        console.log(`Tokens eWeLink salvos para o usuário ${userId}. Redirecionando para o dashboard.`);
        // Redirecione o usuário para o seu dashboard ou uma página de sucesso no frontend
        res.redirect('http://localhost:3000/dashboard'); // Ajuste para a URL do seu frontend

    } catch (err) {
        console.error('Erro ao trocar código por token eWeLink:', err.response ? err.response.data : err.message);
        // Redirecione para uma página de erro ou exiba uma mensagem amigável
        res.status(500).send('Erro ao conectar com eWeLink. Por favor, tente novamente.');
    }
});

/**
 * @func refreshEwelinkToken
 * @desc Função auxiliar para refrescar o access token da eWeLink.
 * @param {string} userId - ID do usuário no seu sistema.
 * @returns {Promise<boolean>} True se o token foi refrescado com sucesso, false caso contrário.
 */
async function refreshEwelinkToken(userId) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { ewelinkRefreshToken: true, ewelinkAccessToken: true, ewelinkTokenExpiresAt: true }
        });

        if (!user || !user.ewelinkRefreshToken) {
            console.warn(`Usuário ${userId} não possui refresh token eWeLink.`);
            return false;
        }

        // Verifica se o token ainda não expirou ou se está prestes a expirar (ex: em 5 minutos)
        // Isso evita refrescar desnecessariamente
        if (user.ewelinkTokenExpiresAt && user.ewelinkTokenExpiresAt.getTime() > (Date.now() + (5 * 60 * 1000))) {
            console.log(`Access token eWeLink para ${userId} ainda é válido.`);
            return true; // Token ainda válido, não precisa refrescar agora
        }

        console.log(`Refrescando access token eWeLink para userId: ${userId}...`);

        const refreshResponse = await axios.post(EWE_REFRESH_TOKEN_URL, null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: user.ewelinkRefreshToken,
                client_id: EWE_CLIENT_ID,
                client_secret: EWE_CLIENT_SECRET
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, refresh_token, expires_in, region } = refreshResponse.data;

        await prisma.user.update({
            where: { id: userId },
            data: {
                ewelinkAccessToken: access_token,
                // O refresh_token pode ou não ser retornado no refresh.
                // Se for, atualize. Se não, mantenha o antigo.
                ewelinkRefreshToken: refresh_token || user.ewelinkRefreshToken,
                ewelinkRegion: region || user.ewelinkRegion, // A região pode mudar ou não
                ewelinkTokenExpiresAt: new Date(Date.now() + (expires_in * 1000))
            }
        });

        console.log(`Access token eWeLink refrescado com sucesso para userId: ${userId}`);
        return true;

    } catch (err) {
        console.error('Erro ao refrescar token eWeLink:', err.response ? err.response.data : err.message);
        // Se o refresh token falhar (ex: expirou, inválido), o usuário precisará reconectar
        if (err.response && err.response.status === 401) {
            console.warn(`Refresh token eWeLink para ${userId} inválido/expirado. Removendo tokens.`);
            await prisma.user.update({
                where: { id: userId },
                data: {
                    ewelinkAccessToken: null,
                    ewelinkRefreshToken: null,
                    ewelinkRegion: null,
                    ewelinkTokenExpiresAt: null
                }
            });
            // Você pode redirecionar o usuário para a página de reconexão
        }
        return false;
    }
}


/**
 * @route GET /api/ewelink/devices
 * @desc Rota protegida para buscar a lista de dispositivos eWeLink do usuário.
 * Requer que o usuário esteja logado no SEU sistema e tenha conectado a eWeLink.
 */
router.get('/devices', authenticateToken, async(req, res) => {
    const userId = req.user.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                ewelinkAccessToken: true,
                ewelinkRefreshToken: true,
                ewelinkRegion: true,
                ewelinkTokenExpiresAt: true
            }
        });

        if (!user || !user.ewelinkAccessToken || !user.ewelinkRegion) {
            return res.status(400).json({ message: 'Sua conta eWeLink não está conectada. Por favor, conecte-a primeiro.' });
        }

        // Verifica se o access token expirou ou está próximo de expirar
        // E tenta refrescá-lo automaticamente
        if (user.ewelinkTokenExpiresAt && user.ewelinkTokenExpiresAt.getTime() < Date.now() + (5 * 60 * 1000)) { // Expira em menos de 5 minutos
            const refreshed = await refreshEwelinkToken(userId);
            if (!refreshed) {
                // Se não conseguir refrescar, peça para o usuário reconectar
                return res.status(401).json({ message: 'Sua sessão eWeLink expirou. Por favor, reconecte sua conta eWeLink.' });
            }
            // Recarregar o usuário para obter o novo token
            const updatedUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { ewelinkAccessToken: true, ewelinkRegion: true }
            });
            user.ewelinkAccessToken = updatedUser.ewelinkAccessToken;
            user.ewelinkRegion = updatedUser.ewelinkRegion;
        }

        // Determina a URL base da API da eWeLink com base na região do usuário
        const eweApiBaseUrl = `https://${user.ewelinkRegion}-api.coolkit.cc/v2`;

        console.log(`Buscando dispositivos eWeLink para userId: ${userId} na região: ${user.ewelinkRegion}`);

        // Exemplo de chamada para listar dispositivos (GET /device/thing)
        const devicesResponse = await axios.get(`${eweApiBaseUrl}/device/thing`, {
            headers: {
                'Authorization': `Bearer ${user.ewelinkAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json({
            message: 'Dispositivos eWeLink carregados com sucesso!',
            devices: devicesResponse.data.data // A estrutura da resposta da eWeLink pode variar, ajuste conforme necessário
        });

    } catch (err) {
        console.error('Erro ao buscar dispositivos eWeLink:', err.response ? err.response.data : err.message);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            // Se o token for inválido, remova-o e peça para reconectar
            await prisma.user.update({
                where: { id: userId },
                data: {
                    ewelinkAccessToken: null,
                    ewelinkRefreshToken: null,
                    ewelinkRegion: null,
                    ewelinkTokenExpiresAt: null
                }
            });
            return res.status(401).json({ message: 'Token eWeLink inválido ou expirado. Por favor, reconecte sua conta eWeLink.' });
        }
        res.status(500).json({ message: 'Erro interno ao buscar dados da eWeLink.' });
    }
});


// Rotas para controlar um dispositivo específico (ex: ligar/desligar)
// router.post('/device/:deviceId/status', authenticateToken, async (req, res) => {
//     const { deviceId } = req.params;
//     const { status } = req.body; // 'on' ou 'off'
//     const userId = req.user.userId;

//     try {
//         const user = await prisma.user.findUnique({
//             where: { id: userId },
//             select: { ewelinkAccessToken: true, ewelinkRegion: true }
//         });

//         if (!user || !user.ewelinkAccessToken || !user.ewelinkRegion) {
//             return res.status(400).json({ message: 'Conecte sua conta eWeLink primeiro.' });
//         }

//         const eweApiBaseUrl = `https://${user.ewelinkRegion}-api.coolkit.cc/v2`;

//         // Exemplo de chamada para controlar um dispositivo (POST /device/thing/status)
//         // A estrutura exata do payload pode variar dependendo do tipo de dispositivo
//         const controlResponse = await axios.post(`${eweApiBaseUrl}/device/thing/status`, {
//             thingList: [
//                 {
//                     thingId: deviceId,
//                     params: {
//                         switch: status // ou 'power', 'state' dependendo do dispositivo
//                     }
//                 }
//             ]
//         }, {
//             headers: {
//                 'Authorization': `Bearer ${user.ewelinkAccessToken}`,
//                 'Content-Type': 'application/json'
//             }
//         });

//         res.json({
//             message: `Dispositivo ${deviceId} ${status === 'on' ? 'ligado' : 'desligado'} com sucesso!`,
//             data: controlResponse.data
//         });

//     } catch (err) {
//         console.error('Erro ao controlar dispositivo eWeLink:', err.response ? err.response.data : err.message);
//         res.status(500).json({ message: 'Erro ao controlar dispositivo eWeLink.' });
//     }
// });


module.exports = router;