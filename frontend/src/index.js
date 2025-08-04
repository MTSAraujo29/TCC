/**
 * Ponto de Entrada da Aplicação React
 * 
 * Arquivo responsável pela inicialização e renderização
 * da aplicação no DOM. Configura React 18 com Strict Mode
 * para detecção de problemas em desenvolvimento.
 * 
 * @module Index
 * @requires react
 * @requires react-dom/client
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// === IMPORTAÇÕES DE ESTILOS E COMPONENTES ===
import './index.css'; // Estilos base globais
import App from './App'; // Componente raiz da aplicação

// === INICIALIZAÇÃO DA APLICAÇÃO ===
// Cria root usando a nova API do React 18
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderiza aplicação com React.StrictMode para desenvolvimento
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);