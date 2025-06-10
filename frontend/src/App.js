// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreateAccountPage from './pages/CreateAccountPage';
import './App.css'; // Estilos globais para a aplicação

function App() {
  return (
      <Router>
        <Routes>
          {/* Rota inicial que redireciona para a página de Login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/create-account" element={<CreateAccountPage />} />
        </Routes>
      </Router>
  );
}

export default App;