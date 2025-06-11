// backend/routes/ewelinkAuthRoutes.js
const express = require('express');
const router = express.Router();
const ewelinkController = require('../controllers/ewelink.controller'); // Importa o controller

// O middleware authenticateToken já está definido em server.js
// e será aplicado nas rotas que você deseja proteger.
// Não precisamos duplicá-lo aqui.

// IMPORTANTE:
// Certifique-se de que `authenticateToken` está sendo usado no `server.js`
// ANTES de aplicar essas rotas, ou aplique-o individualmente aqui
// se você não quiser proteger TODAS as rotas com ele.
// Para este exemplo, vamos supor que ele será aplicado via `app.use(authenticateToken, ewelinkAuthRoutes);`
// ou individualmente como `router.get('/devices', authenticateToken, ewelinkController.getDevices);`

// Se o `authenticateToken` já estiver globalmente em `server.js` (como no seu código),
// então não precisa adicionar ele aqui novamente.
// Se ele for usado apenas para rotas específicas, então adicione-o aqui.

// Vamos aplicar individualmente para maior clareza, pois nem todas as rotas eWeLink
// precisam do authenticateToken (o callback é público).

/**
 * @route GET /api/ewelink/authorize
 * @desc Inicia o fluxo OAuth 2.0 da eWeLink.
 * Requer que o usuário esteja logado no SEU sistema (via JWT).
 */
router.get('/authorize', authenticateToken, ewelinkController.authorize);

/**
 * @route GET /api/ewelink/callback
 * @desc Endpoint de callback para onde a eWeLink redireciona após a autorização do usuário.
 * Esta rota não requer autenticação JWT do seu sistema, pois é a eWeLink que a chama.
 */
router.get('/callback', ewelinkController.callback);

/**
 * @route GET /api/ewelink/devices
 * @desc Rota protegida para buscar a lista de dispositivos eWeLink do usuário.
 * Requer que o usuário esteja logado no SEU sistema e tenha conectado a eWeLink.
 */
router.get('/devices', authenticateToken, ewelinkController.getDevices);

/**
 * @route POST /api/ewelink/control-device
 * @desc Controla um dispositivo eWeLink (ligar/desligar).
 * Requer que o usuário esteja logado no SEU sistema e tenha conectado a eWeLink.
 */
router.post('/control-device', authenticateToken, ewelinkController.controlDevice);

module.exports = router;

// Nota: A função `authenticateToken` precisa estar disponível neste escopo.
// Se ela estiver apenas em `server.js`, você pode passá-la como um middleware
// para `app.use('/api/ewelink', authenticateToken, ewelinkAuthRoutes);` em `server.js`
// Ou importá-la para cá, mas o ideal é ter uma única fonte para middlewares globais.
// Por simplicidade para a refatoração, vamos assumir que `authenticateToken`
// é acessível aqui ou será aplicado externamente.
// PARA O SEU CÓDIGO ATUAL, VAMOS IMPORTAR O JWT E A FUNÇÃO AQUI PARA QUE FUNCIONE.
// Em um projeto maior, você teria um arquivo de middleware separado.
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET; // Carregar do .env, ou garantir que já esteja carregado

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