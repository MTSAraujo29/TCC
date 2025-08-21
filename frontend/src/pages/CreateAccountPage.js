import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./CreateAccountPage.css";

function CreateAccountPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validações
    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        "https://tcc-ft7k.onrender.com/api/register",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Conta criada com sucesso, redirecionar para login
        alert("Conta criada com sucesso! Faça login para continuar.");
        navigate("/login");
      } else {
        setError(data.message || "Erro ao criar conta");
      }
    } catch (err) {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="create-account-container">
      <div className="create-account-background">
        <div className="create-account-background-pattern"></div>
      </div>

      <div className="create-account-card">
        <div className="create-account-header">
          <div className="create-account-logo">
            <img
              src="/icon.png"
              alt="Smart Energy Logo"
              className="create-account-logo-img"
            />
            <h1 className="create-account-title">Smart Energy</h1>
            <p className="create-account-subtitle">
              Crie sua conta para começar
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="create-account-form">
          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Nome Completo
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Seu nome completo"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Senha
            </label>
            <div className="password-input-container">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="form-input"
                placeholder="••••••••"
                required
              />
              <button 
                type="button" 
                className="password-toggle-btn" 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Confirmar Senha
            </label>
            <div className="password-input-container">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="form-input"
                placeholder="••••••••"
                required
              />
              <button 
                type="button" 
                className="password-toggle-btn" 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="create-account-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner">
                <div className="spinner"></div>
                Criando conta...
              </span>
            ) : (
              "Criar Conta"
            )}
          </button>
        </form>

        <div className="create-account-footer">
          <p className="create-account-footer-text">
            Já tem uma conta?{" "}
            <Link to="/login" className="create-account-footer-link">
              Fazer login
            </Link>
          </p>
          <Link to="/" className="create-account-back-link">
            ← Voltar para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export default CreateAccountPage;
