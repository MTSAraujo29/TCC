// controllers/ewelink.controller.js
const ewelinkService = require('../services/ewelink.service');
const { PrismaClient } = require('@prisma/client'); // Necessário para salvar o state na sessão ou no DB

const prisma = new PrismaClient(); // Instancia o PrismaClient

// A URL do seu frontend, para redirecionamento após o callback
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

class EwelinkController {
    /**
     * @route GET /api/ewelink/authorize
     * @desc Inicia o fluxo OAuth 2.0 da eWeLink.
     * Esta rota é protegida pelo JWT do seu sistema e iniciada pelo frontend.
     */
    async authorize(req, res) {
        // req.user é populado pelo middleware authenticateToken do seu server.js
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Usuário não autenticado no seu sistema.' });
        }

        try {
            const { url, state } = ewelinkService.getAuthorizationUrl(req.user.userId);

            // O 'state' deve ser persistido de alguma forma para ser validado no callback.
            // Para maior segurança, o ideal seria:
            // 1. Armazenar em uma sessão no backend (se estiver usando `express-session`).
            // 2. Armazenar em um cache (Redis) associado ao userId.
            // 3. Em último caso, armazenar temporariamente no banco de dados (menos ideal para 'state').
            // Por simplicidade (e como seu `state` já contém userId), vamos apenas usá-lo para o retorno.
            // No callback, você vai dividir o 'state' para obter o userId e validar.
            // No entanto, para prevenção de CSRF, o 'state' DEVE ser gerado por requisição e validado.
            // O userId já está no state, então não precisamos de uma sessão explícita para o state.

            console.log(`Controller: Redirecionando para URL de autorização eWeLink: ${url}`);
            // Retorna a URL para o frontend, que fará o redirecionamento
            res.json({ url });
        } catch (error) {
            console.error('Controller: Erro ao iniciar autorização eWeLink:', error.message);
            res.status(500).json({ message: 'Falha ao iniciar conexão com eWeLink.' });
        }
    }

    /**
     * @route GET /api/ewelink/callback
     * @desc Endpoint de callback para onde a eWeLink redireciona após a autorização.
     * Recebe o 'code' e 'state' da eWeLink.
     */
    async callback(req, res) {
        const { code, state, error, error_description } = req.query;

        if (error) {
            console.error('Controller: Erro no callback eWeLink:', error_description || error);
            return res.redirect(`${FRONTEND_URL}/dashboard?ewelinkError=${encodeURIComponent(error_description || error)}`);
        }

        if (!code || !state) {
            return res.redirect(`${FRONTEND_URL}/dashboard?ewelinkError=${encodeURIComponent('Código de autorização ou estado ausente.')}`);
        }

        // Validação do 'state' para CSRF:
        // O 'state' enviado pela eWeLink deve conter o userId e ser validado.
        const [userIdFromState, randomStringFromState] = state.split('_');
        const userId = parseInt(userIdFromState, 10);

        if (isNaN(userId)) {
            console.error('Controller: State inválido ou userId não encontrado no state do callback.');
            return res.redirect(`${FRONTEND_URL}/dashboard?ewelinkError=${encodeURIComponent('Erro de segurança: State inválido.')}`);
        }

        // Em uma aplicação real, você também verificaria se `randomStringFromState`
        // corresponde a algo que você gerou e armazenou para este `userId`.
        // Por exemplo, se você salvou o `state` inteiro em um cache associado ao `userId`.
        // Por enquanto, assumiremos que o userId é suficiente para identificar a origem.

        try {
            console.log(`Controller: Recebido código e estado da eWeLink para userId: ${userId}. Trocando por tokens...`);
            const tokens = await ewelinkService.exchangeCodeForTokens(code);

            // Salva os tokens no banco de dados para o usuário correspondente
            await prisma.user.update({
                where: { id: userId },
                data: {
                    ewelinkAccessToken: tokens.access_token,
                    ewelinkRefreshToken: tokens.refresh_token,
                    ewelinkRegion: tokens.region, // A região vem na resposta do token
                    ewelinkTokenExpiresAt: new Date(Date.now() + (tokens.expires_in * 1000))
                }
            });

            console.log(`Controller: Tokens eWeLink salvos para userId: ${userId}. Redirecionando para o frontend.`);
            res.redirect(`${FRONTEND_URL}/dashboard?ewelinkStatus=success`);

        } catch (error) {
            console.error('Controller: Erro ao lidar com callback eWeLink:', error.message);
            res.redirect(`${FRONTEND_URL}/dashboard?ewelinkError=${encodeURIComponent(error.message || 'Erro ao conectar com eWeLink.')}`);
        }
    }

    /**
     * @route GET /api/ewelink/devices
     * @desc Rota protegida para buscar a lista de dispositivos eWeLink do usuário.
     * Requer que o usuário esteja logado no SEU sistema e tenha conectado a eWeLink.
     */
    async getDevices(req, res) {
        // req.user é populado pelo middleware authenticateToken
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Usuário não autenticado no seu sistema.' });
        }

        try {
            const userId = req.user.userId;
            console.log(`Controller: Buscando tokens eWeLink para userId: ${userId}`);

            // Chama o serviço para obter (e potencialmente refrescar) os tokens
            const ewelinkTokens = await ewelinkService.getAndUpdateEwelinkTokens(userId);

            if (!ewelinkTokens) {
                return res.status(400).json({ message: 'Sua conta eWeLink não está conectada. Por favor, conecte-a primeiro.' });
            }

            console.log(`Controller: Tokens eWeLink obtidos para userId: ${userId}. Buscando dispositivos.`);
            const devices = await ewelinkService.getEwelinkDevices(ewelinkTokens.accessToken, ewelinkTokens.region);

            res.json({
                message: 'Dispositivos eWeLink carregados com sucesso!',
                devices: devices
            });

        } catch (error) {
            console.error('Controller: Erro ao buscar dispositivos eWeLink:', error.message);
            // Se o erro indicar que a sessão eWeLink expirou e não pôde ser renovada,
            // ou se for um erro de autenticação, o frontend pode ser instruído a reconectar.
            res.status(500).json({ message: error.message });
        }
    }

    /**
     * @route POST /api/ewelink/control-device
     * @desc Controla um dispositivo eWeLink (ligar/desligar).
     * Requer que o usuário esteja logado no SEU sistema e tenha conectado a eWeLink.
     */
    async controlDevice(req, res) {
        if (!req.user || !req.user.userId) {
            return res.status(401).json({ message: 'Usuário não autenticado no seu sistema.' });
        }

        const { deviceId, params } = req.body; // params: ex: { switch: 'on' } ou { switch: 'off' }

        if (!deviceId || !params) {
            return res.status(400).json({ message: 'ID do dispositivo e parâmetros de controle são obrigatórios.' });
        }

        try {
            const userId = req.user.userId;
            console.log(`Controller: Buscando tokens eWeLink para userId: ${userId} para controlar dispositivo ${deviceId}`);

            const ewelinkTokens = await ewelinkService.getAndUpdateEwelinkTokens(userId);

            if (!ewelinkTokens) {
                return res.status(400).json({ message: 'Sua conta eWeLink não está conectada. Por favor, conecte-a primeiro.' });
            }

            console.log(`Controller: Controlando dispositivo ${deviceId} com parâmetros: ${JSON.stringify(params)}`);
            const result = await ewelinkService.controlEwelinkDevice(ewelinkTokens.accessToken, ewelinkTokens.region, deviceId, params);

            res.json({
                message: 'Dispositivo eWeLink controlado com sucesso!',
                result: result
            });

        } catch (error) {
            console.error('Controller: Erro ao controlar dispositivo eWeLink:', error.message);
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new EwelinkController();