import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./LoginPage.css";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("https://tcc-ft7k.onrender.com/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Salvar token e informações do usuário
        localStorage.setItem("token", data.token);
        localStorage.setItem("userName", data.user.name);
        localStorage.setItem("userEmail", data.user.email);

        // Calcular expiração do token (1 hora)
        const tokenExp = Math.floor(Date.now() / 1000) + 3600;
        localStorage.setItem("token_exp", tokenExp.toString());

        // Redirecionar para o dashboard
        navigate("/dashboard");
      } else {
        setError(data.message || "Erro ao fazer login");
      }
    } catch (err) {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-background-pattern"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img
              src="/icon.png"
              alt="Smart Energy Logo"
              className="login-logo-img"
            />
            <h1 className="login-title">Smart Energy</h1>
            <p className="login-subtitle">
              Faça login para acessar seu dashboard
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Senha
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? (
              <span className="loading-spinner">
                <div className="spinner"></div>
                Entrando...
              </span>
            ) : (
              "Entrar"
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-footer-text">
            Não tem uma conta?{" "}
            <Link to="/create-account" className="login-footer-link">
              Criar conta
            </Link>
          </p>
          <Link to="/" className="login-back-link">
            ← Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
