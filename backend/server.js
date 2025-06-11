// backend/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

// Carrega as variáveis de ambiente do .env na raiz do backend
// Garanta que o arquivo .env está na mesma pasta que server.js, ou ajuste o path.
// Se seu .env está em `tcc/.env` e o backend é `tcc/backend`, então o path é `../.env`
require('dotenv').config({ path: './.env' }); // <-- Verifique este caminho! Se o .env está na raiz do 'backend', use './.env'. Se está na raiz do projeto 'tcc', use '../.env'.

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERRO: JWT_SECRET não está definido no arquivo .env!');
    process.exit(1);
}

// Configurações e Instâncias
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors());

// =========================================================================
// Middleware de Autenticação JWT ÚNICO
// Movido para cá para ser usado globalmente ou importado onde necessário
// =========================================================================
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Erro de verificação JWT:', err);
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }
        req.user = user;
        next();
    });
}
// Exportar o authenticateToken para ser usado em routes/ewelinkAuthRoutes.js
module.exports.authenticateToken = authenticateToken; // Exporta para que possa ser importado

// =========================================================================
// IMPORTAÇÃO E USO DAS ROTAS DA eWeLink
// =========================================================================
const ewelinkAuthRoutes = require('./routes/ewelinkAuthRoutes');

// Rota de Health Check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Use as rotas da eWeLink.
// NOTA: Se você exportar `authenticateToken` do `server.js` e importar em `ewelinkAuthRoutes.js`,
// e usar lá, você pode usar `app.use('/api/ewelink', ewelinkAuthRoutes);` aqui.
// Eu sugiro que você **MANTENHA A FUNÇÃO `authenticateToken` DENTRO DO `ewelinkAuthRoutes.js` COMO NO PASSO 3**,
// para simplificar e evitar dependências circulares ou problemas de escopo.
// E remova a definição dela daqui do `server.js` se for o caso.
// Vou deixar a versão que assume que `authenticateToken` é definido em `ewelinkAuthRoutes.js`.
app.use('/api/ewelink', ewelinkAuthRoutes);


// Rota de teste simples
app.get('/', (req, res) => {
    res.send('Servidor Backend (Node.js com Express) rodando com Prisma, Hashing e JWT!');
});

// =========================================================================
// Rota Protegida: Dados para o Dashboard (usando seu próprio JWT)
// =========================================================================
// Mantenha apenas UMA rota /api/dashboard/data.
// A rota que busca dados da eWeLink será /api/ewelink/devices, não confunda.
app.get('/api/dashboard/data', authenticateToken, async (req, res) => {
    console.log('Acesso à rota de dados do dashboard por:', req.user.email);
    // Aqui você pode retornar dados mockados ou dados reais do seu próprio sistema,
    // que não sejam diretamente da eWeLink.
    res.json({
        message: 'Dados do Dashboard carregados com sucesso!',
        devices: [
            { id: 'dev1', name: 'Lâmpada Sala', type: 'light', status: 'on', consumption_kwh: 0.15 },
            { id: 'dev2', name: 'Tomada Cozinha', type: 'outlet', status: 'off', consumption_kwh: 0.02 },
            { id: 'dev3', name: 'Ar Condicionado', type: 'ac', status: 'on', consumption_kwh: 1.2 },
            { id: 'dev4', name: 'Geladeira', type: 'refrigerator', status: 'on', consumption_kwh: 0.5 }
        ],
        daily_consumption_kwh: [10.5, 12.0, 8.3, 15.1, 11.7, 13.5, 9.8],
        daily_consumption_labels: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    });
});


// Rota para CRIAR CONTA (Registro de Usuário)
app.post('/api/register', async(req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos (Nome, Email, Senha) são obrigatórios.' });
    }

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email: email },
        });

        if (existingUser) {
            return res.status(409).json({ message: 'Este email já está registrado. Por favor, faça login.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
            },
        });

        res.status(201).json({
            message: 'Conta criada com sucesso!',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
            }
        });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar registrar. Tente novamente mais tarde.' });
    }
});

// Rota para LOGIN de Usuário
app.post('/api/login', async(req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email e Senha são obrigatórios.' });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: email },
        });

        if (!user) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email },
            JWT_SECRET, { expiresIn: '1h' }
        );

        res.json({
            message: 'Login bem-sucedido!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            }
        });

    } catch (error) {
        console.error('Erro ao fazer login do usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao tentar fazer login. Tente novamente mais tarde.' });
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});