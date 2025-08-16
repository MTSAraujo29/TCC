import React from "react";
import { Link } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  return (
    <div className="homepage-container">
      {/* Header Hero */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-logo">
            <img
              src="/icon.png"
              alt="Smart Energy Logo"
              className="hero-logo-img"
            />
            <h1 className="hero-title">
              Smart Energy
              <span className="hero-subtitle">
                Sistema Inteligente de Gerenciamento de Energia
              </span>
            </h1>
          </div>
          <p className="hero-description">
            Monitore, controle e otimize o consumo de energia elétrica em tempo
            real. Tecnologia IoT avançada para uma gestão inteligente e
            sustentável.
          </p>
          <div className="hero-features">
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span>Monitoramento em Tempo Real</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔌</span>
              <span>Controle Remoto de Dispositivos</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span>Análise Avançada de Consumo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="cta-section">
        <div className="cta-content">
          <h2>Comece a Economizar Energia Hoje</h2>
          <p>
            Junte-se aos usuários que já estão economizando com Smart
            Energy
          </p>
          <div className="cta-buttons">
            <Link to="/login" className="cta-button primary">
              Entrar na Conta
            </Link>
            <Link to="/create-account" className="cta-button secondary">
              Criar Nova Conta
            </Link>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="features-section">
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-card-icon">📱</div>
            <h3>Interface Intuitiva</h3>
            <p>
              Dashboard moderno e responsivo para monitoramento em qualquer
              dispositivo
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">🔒</div>
            <h3>Segurança Avançada</h3>
            <p>Autenticação JWT e criptografia para proteger seus dados</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">📈</div>
            <h3>Relatórios Detalhados</h3>
            <p>Análise completa do consumo com gráficos interativos</p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">⚙️</div>
            <h3>Automação Inteligente</h3>
            <p>Agendamento automático para otimizar o uso de energia</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer-section">
        <div className="footer-content">
          <p>
            &copy; 2025 Smart Energy. Sistema de Gerenciamento Inteligente de
            Energia.
          </p>
          <p>TCC - Trabalho de Conclusão de Curso</p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
