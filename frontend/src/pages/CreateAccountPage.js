import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../App.css";
import { API_ENDPOINTS } from "../config/api";
import CustomAlert from "../components/CustomAlert";
import useCustomAlert from "../hooks/useCustomAlert";

// SVG Components
const EyeOpen = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#888"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <ellipse cx="12" cy="12" rx="8" ry="5" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

const EyeClosed = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#888"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 1l22 22" />
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-5.05 0-9.29-3.14-10.74-7.5a10.97 10.97 0 0 1 1.66-3.13" />
    <path d="M9.53 9.53A3.5 3.5 0 0 0 12 15.5c1.38 0 2.63-.83 3.16-2.03" />
  </svg>
);

// Reusable Password Input Component
const PasswordInput = ({
  name,
  placeholder,
  value,
  show,
  setShow,
  onChange,
}) => (
  <div style={{ position: "relative" }}>
    <input
      type={show ? "text" : "password"}
      name={name}
      placeholder={placeholder}
      required
      value={value}
      onChange={onChange}
      style={{ paddingRight: 40 }}
    />
    <span
      onClick={() => setShow((v) => !v)}
      style={{
        position: "absolute",
        right: 10,
        top: "50%",
        transform: "translateY(-50%)",
        cursor: "pointer",
        color: "#888",
        fontSize: 18,
      }}
      title={show ? "Ocultar senha" : "Mostrar senha"}
    >
      {show ? <EyeClosed /> : <EyeOpen />}
    </span>
  </div>
);

function CreateAccountPage() {
  // Navigation
  const navigate = useNavigate();

  // State management
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { alertState, showSuccess, showError, hideAlert } = useCustomAlert();

  // Event handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    try {
      console.log("Iniciando registro de usuário...");
      const response = await registerUser();
      console.log("Resposta da API:", response);

      const data = await response.json();
      console.log("Dados da resposta:", data);

      if (response.ok) {
        handleRegistrationSuccess(data);
      } else {
        handleRegistrationError(data);
      }
    } catch (err) {
      console.error("Erro durante o registro:", err);
      handleNetworkError(err);
    }
  };

  // Form validation
  const validateForm = () => {
    console.log("Validando formulário:", formData);

    // Verificar se todos os campos estão preenchidos
    if (!formData.name || !formData.name.trim()) {
      setError("Nome é obrigatório!");
      showError("Nome é obrigatório!", "Campo Obrigatório");
      return false;
    }

    if (!formData.email || !formData.email.trim()) {
      setError("Email é obrigatório!");
      showError("Email é obrigatório!", "Campo Obrigatório");
      return false;
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Formato de email inválido!");
      showError("Formato de email inválido!", "Email Inválido");
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres!");
      showError("Senha deve ter pelo menos 6 caracteres!", "Senha Inválida");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("As senhas não coincidem!");
      showError("As senhas não coincidem!", "Senhas Diferentes");
      return false;
    }

    console.log("Formulário validado com sucesso!");
    return true;
  };

  // API functions
  const registerUser = async () => {
    const requestData = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
    };

    console.log("Enviando dados para API:", requestData);
    console.log("URL da API:", API_ENDPOINTS.REGISTER);

    return await fetch(API_ENDPOINTS.REGISTER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });
  };

  // Response handlers
  const handleRegistrationSuccess = (data) => {
    console.log("Account created successfully:", data);
    showSuccess(
      "Sua conta foi criada com sucesso! Faça login agora.",
      "Conta Criada!"
    );
    setTimeout(() => {
      navigate("/login");
    }, 2000);
  };

  const handleRegistrationError = (data) => {
    console.error("Account creation failed:", data);

    let errorMessage = "Erro ao criar conta. Tente novamente.";

    // Se há erros de validação específicos, mostrar o primeiro
    if (data.errors && data.errors.length > 0) {
      errorMessage = data.errors[0].msg;
    } else if (data.message) {
      errorMessage = data.message;
    }

    setError(errorMessage);
    showError(errorMessage, "Erro na Criação");
  };

  const handleNetworkError = (err) => {
    console.error("Network error during registration:", err);
    const errorMessage =
      "Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.";
    setError(errorMessage);
    showError(errorMessage, "Erro de Conexão");
  };

  return (
    <div className="container">
      <div className="card">
        <div className="logo-icon">
          <img
            src="/icon.png"
            alt="Ícone"
            style={{ width: 40, height: 40, marginBottom: 8 }}
          />
        </div>

        <h2>Criar Conta</h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Nome"
            required
            value={formData.name}
            onChange={handleInputChange}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            value={formData.email}
            onChange={handleInputChange}
          />

          <PasswordInput
            name="password"
            placeholder="Senha"
            value={formData.password}
            show={showPassword}
            setShow={setShowPassword}
            onChange={handleInputChange}
          />

          <PasswordInput
            name="confirmPassword"
            placeholder="Confirmar Senha"
            value={formData.confirmPassword}
            show={showConfirmPassword}
            setShow={setShowConfirmPassword}
            onChange={handleInputChange}
          />

          {error && <p style={{ color: "red", fontSize: "0.9em" }}>{error}</p>}

          <button type="submit">Criar</button>
        </form>

        <Link to="/login" className="link-button">
          Volta para Login
        </Link>
      </div>

      <CustomAlert
        isOpen={alertState.isOpen}
        onClose={hideAlert}
        type={alertState.type}
        title={alertState.title}
        message={alertState.message}
        autoClose={alertState.autoClose}
        autoCloseTime={alertState.autoCloseTime}
      />
    </div>
  );
}

export default CreateAccountPage;
