Excelente ideia\! O arquivo `README.md` é a vitrine do seu projeto e a primeira coisa que avaliadores e futuros desenvolvedores verão.

Com base em toda a arquitetura e no código do seu TCC, criei um conteúdo detalhado e profissional, usando os termos técnicos corretos:

-----

# ⚡ Smart Energy: Sistema Inteligente de Gerenciamento de Energia IoT

## 🚀 Objetivo do Projeto

O **Smart Energy** é um sistema Full-Stack e IoT desenvolvido como Trabalho de Conclusão de Curso (TCC) para monitorar, controlar e otimizar o consumo de energia elétrica em tempo real. O objetivo principal é demonstrar a integração bem-sucedida de hardware (Sonoff POW), protocolo de comunicação leve (MQTT) e uma aplicação web moderna (React/Node.js) baseada em uma arquitetura limpa e escalável.

## ✨ Principais Funcionalidades

| Categoria | Funcionalidade | Descrição Técnica |
| :--- | :--- | :--- |
| **Monitoramento IoT** | **Visualização em Tempo Real** | Exibe a Potência (Watts), Corrente (Amperes), Tensão (Volts) e Energia Total (kWh) dos dispositivos Sonoff, atualizados a cada 10 segundos no Dashboard. |
| **Controle Remoto** | **Ligar/Desligar Dispositivo** | Permite o controle remoto dos Sonoffs através de comandos MQTT (tópico `cmnd/.../POWER`), enviados pelo Backend ao Broker HiveMQ. |
| **Análise de Consumo** | **Dashboard Interativo** | Apresenta métricas globais e gráficos detalhados (Diário, Semanal, Mensal) do consumo histórico de energia. |
| **Automação** | **Agendamento ON/OFF** | Permite configurar agendamentos semanais (`TimerX` do Tasmota) para ligar ou desligar dispositivos automaticamente, promovendo a economia. |
| **Assistente Inteligente** | **EcoBot** | Chatbot embutido no Frontend (React) que fornece explicações sobre conceitos elétricos (Potência, Tensão, Fator de Potência) e dicas de economia. |
| **Segurança** | **Autenticação JWT** | Proteção de rotas com Tokens Web JSON (JWT) e criptografia de senhas com Bcrypt. |

## 🛠️ Tecnologias Utilizadas

O projeto utiliza uma arquitetura **Full-Stack MERN-IoT**:

| Camada | Tecnologia | Propósito no Projeto |
| :--- | :--- | :--- |
| **Frontend** | **React.js** | Interface do usuário (Single Page Application - SPA) e gerenciamento de estado. |
| **Backend** | **Node.js, Express** | Servidor web robusto, responsável por hospedar a API RESTful e gerenciar a lógica de negócios. |
| **Banco de Dados** | **MongoDB** | Banco de dados NoSQL para flexibilidade e escalabilidade no armazenamento de dados de usuários e leituras de energia. |
| **ORM** | **Prisma** | Moderno ORM/Query Builder que fornece segurança de tipos e simplifica a interação entre Node.js e MongoDB. |
| **IoT Protocolo** | **MQTT** | Protocolo de mensageria leve e eficiente, ideal para comunicação com o hardware (Sonoff) através do Broker HiveMQ. |
| **IoT Hardware** | **Sonoff POW com Tasmota** | Dispositivo físico (hardware) e firmware customizado responsável pela coleta e envio dos dados de energia. |
| **Hospedagem** | **Render.com** (exemplo) | Plataforma de *cloud* para hospedagem do Backend. |
| **Versionamento** | **Git & GitHub** | Controle de versão, colaboração e documentação do código-fonte. |

## 📐 Estrutura do Projeto (Arquitetura em Camadas)

O projeto adota o princípio de **Separação de Preocupações**, dividindo o código em camadas distintas:

### Pasta `backend/`

| Pasta | Responsabilidade | Exemplo de Arquivo |
| :--- | :--- | :--- |
| **`controllers`** | **Coordenar a requisição/resposta.** Recebe dados da rota, chama os `services` e envia a resposta final. | `tasmota.controller.js` |
| **`services`** | **Lógica de Negócios.** Contém as regras complexas, como a **conexão MQTT** (`tasmota.service.js`) e a **regra de persistência de energia** (`energyTotalManager.js`). | `energyTotalManager.js` |
| **`routes`** | **Mapeamento de URLs.** Associa URLs (`/devices`, `/data`) aos *middlewares* e *controllers*. | `dashboardRoutes.js` |
| **`middleware`** | **Lógica de Segurança.** Intercepta requisições para verificar o JWT. | `authenticateToken.js` |
| **`prisma`** | **Modelagem de Dados.** Define a estrutura do banco (`schema.prisma`). | `schema.prisma` |
| **`api`** | **Ponto de Entrada.** Inicializa o servidor Express, o roteador e o cliente MQTT. | `index.js` |

### Pasta `frontend/src/`

| Pasta | Responsabilidade | Exemplo de Arquivo |
| :--- | :--- | :--- |
| **`pages`** | **Views Principais.** Componentes que representam uma URL (rota). | `DashboardPage.js`, `LoginPage.js` |
| **`config`** | **Configurações Globais.** Contém as URLs dos *endpoints* da API. | `api.js` |
| **`hooks`** | **Lógica Reutilizável de Estado.** Encapsula lógicas complexas do React. | `useCustomAlert.js` |
| **`App.js`** | **Roteamento Principal.** Define quais componentes de `pages` correspondem a cada rota (`/`, `/dashboard`). | `App.js` |

## 🔑 Endpoints da API

O Backend expõe uma API RESTful para comunicação com o Frontend:

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `POST` | `/api/login` | Autentica o usuário e retorna o **JWT** (Token). |
| `POST` | `/api/register` | Cria uma nova conta de usuário. |
| `GET` | `/api/dashboard/data` | **PROTEGIDA** (JWT). Retorna todas as métricas, lista de dispositivos e dados para gráficos do Dashboard. |
| `POST` | `/api/tasmota/devices` | **PROTEGIDA** (JWT). Adiciona um novo dispositivo Tasmota ao usuário. |
| `POST` | `/api/tasmota/devices/:id/power` | **PROTEGIDA** (JWT). Envia o comando MQTT (`ON`/`OFF`) para o dispositivo. |
| `POST` | `/api/tasmota/schedule` | **PROTEGIDA** (JWT). Agenda uma ação ON/OFF no Tasmota (configura o *timer*). |
| `GET` | `/api/dashboard/chart/monthly-energy-data` | **PROTEGIDA** (JWT). Retorna os dados agregados para o gráfico de consumo mensal. |

## 🖥️ Como Executar o Projeto

### Pré-requisitos

1.  Node.js (versão LTS)
2.  MongoDB (local ou na nuvem, como MongoDB Atlas)
3.  Acesso a um Broker MQTT (HiveMQ)
4.  Dispositivo Sonoff configurado com Tasmota e conectado ao Broker.

### 1\. Configuração do Backend

1.  Clone o repositório: `git clone [URL_DO_SEU_REPOSITÓRIO]`
2.  Navegue até a pasta `backend`: `cd backend`
3.  Instale as dependências: `npm install`
4.  Crie o arquivo **`.env`** e configure:
    ```env
    DATABASE_URL="mongodb+srv://[USUARIO]:[SENHA]@[CLUSTER]/[DB_NAME]"
    JWT_SECRET="SEGREDO_MUITO_SECRETO"
    # Configurações do Broker MQTT (HiveMQ)
    MQTT_HOST="SEU_HOST_HIVE_MQ"
    MQTT_PORT=8883
    MQTT_USERNAME="SEU_USUARIO"
    MQTT_PASSWORD="SUA_SENHA"
    # ... adicione as configs do broker 2
    ```
5.  Execute o servidor: `npm start` (ou `npm run dev` se estiver usando `nodemon`)

### 2\. Configuração do Frontend

1.  Navegue para a pasta `frontend`: `cd ../frontend`
2.  Instale as dependências: `npm install`
3.  Crie o arquivo **`.env`** (para produção) ou `.env.local` (para desenvolvimento) e configure a URL da sua API:
    ```env
    REACT_APP_API_URL="https://tcc-ft7k.onrender.com" # Ou sua URL local (http://localhost:3000)
    ```
4.  Execute a aplicação: `npm start`
5.  Acesse: `http://localhost:3000` (porta padrão do React)

## 🌐 Arquitetura de Produção

O Backend (`Node.js/Express`) é idealmente empacotado via **Docker** (para garantir consistência do ambiente) e implantado em um serviço de **Cloud Computing** (como Render ou AWS EC2) que mantém a API RESTful e a conexão MQTT persistentes. O Frontend (React) é servido como arquivos estáticos (`build/`) em um CDN ou no mesmo servidor web do Backend.

## 🤖 Navegação no Dashboard e EcoBot

### Navegando no Dashboard

O `DashboardPage.js` utiliza uma navegação por seções:

  * **Home (`/inicio`):** Visão geral, métricas em tempo real e gráficos de consumo.
  * **Controle de Energia (`/controle`):** Interface para Ligar/Desligar dispositivos e agendar automações ON/OFF.
  * **Relatórios (`/relatorios`):** Detalhes em tempo real dos parâmetros elétricos (V, A, FP) e relatório de otimização de consumo.
  * **Configurações (`/configuracoes`):** Gerenciamento de conta (editar/excluir) e cadastro de novos dispositivos Tasmota (apenas Admin).

### Perguntas Sugeridas para o EcoBot

O EcoBot, implementado no `DashboardPage.js`, é um assistente contextual. Aqui estão perguntas que ele pode responder:

  * "O que é tensão elétrica?"
  * "Qual a diferença entre 110V e 220V no Brasil?"
  * "O que é fator de potência?"
  * "Como economizar energia elétrica?"
  * "O que é kWh?"
  * "Qual a fórmula da potência?"

## 🤝 Contribuição

Este é um projeto de TCC. Contribuições futuras são bem-vindas, especialmente para:

  * Adicionar autenticação Two-Factor (2FA).
  * Implementar testes unitários e de integração para a camada `services`.
  * Migrar o `energyTotalManager` para um sistema de Microsserviços assíncronos.