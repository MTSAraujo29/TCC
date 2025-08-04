/**
 * Aplicação Principal React
 * 
 * Componente raiz que gerencia roteamento e autenticação.
 * Implementa verificação automática de tokens JWT e
 * redirecionamento baseado no estado de autenticação.
 * 
 * Funcionalidades principais:
 * - Roteamento com React Router (HashRouter para compatibilidade)
 * - Validação automática de tokens JWT
 * - Redirecionamento inteligente baseado em autenticação
 * - Limpeza automática de dados expirados
 * 
 * @module App
 * @requires react
 * @requires react-router-dom
 */

import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";

// === IMPORTAÇÃO DE PÁGINAS ===
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CreateAccountPage from "./pages/CreateAccountPage";
import AddDevicePage from "./pages/AddDevicePage";
import FullScreenChartPage from "./pages/FullScreenChartPage";
import HomePage from "./pages/HomePage";

// Estilos globais da aplicação
import "./App.css";

/**
 * Componente de roteamento com lógica de autenticação
 * 
 * Gerencia navegação automática baseada no estado do token JWT.
 * Verifica validade do token a cada mudança de rota.
 */
function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Obtém dados de autenticação do localStorage
    const token = localStorage.getItem("token");
    const tokenExp = localStorage.getItem("token_exp");
    
    if (token && tokenExp) {
      const now = Math.floor(Date.now() / 1000);
      
      // Verifica se token ainda é válido
      if (parseInt(tokenExp, 10) > now) {
        // Token válido - redireciona para dashboard se em página pública
        if (
          location.pathname === "/" ||
          location.pathname === "/login" ||
          location.pathname === "/create-account"
        ) {
          navigate("/dashboard");
        }
      } else {
        // Token expirado - limpa dados e redireciona para home
        localStorage.removeItem("token");
        localStorage.removeItem("token_exp");
        localStorage.removeItem("userName");
        localStorage.removeItem("userEmail");
        
        if (location.pathname !== "/") {
          navigate("/");
        }
      }
    }
  }, [location.pathname, navigate]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/create-account" element={<CreateAccountPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/add-device" element={<AddDevicePage />} />
      <Route path="/grafico-cheio" element={<FullScreenChartPage />} />
    </Routes>
  );
}

/**
 * Componente raiz da aplicação
 * 
 * Configura o roteamento base usando HashRouter para
 * compatibilidade com hospedagem estática.
 */
function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
