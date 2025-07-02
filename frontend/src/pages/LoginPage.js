import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';
import { API_ENDPOINTS } from '../config/api';

function LoginPage() {
    // Hooks
    const navigate = useNavigate();

    // State management
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Event handlers
    function validateEmail(email) {
        // Regex simples para email
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    const handleSubmit = async(e) => {
        e.preventDefault();
        setError('');
        if (!validateEmail(email)) {
            setError('Por favor, insira um email válido.');
            return;
        }
        if (!password || password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(API_ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password: password })
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.message || (data.errors && data.errors[0] ? .msg) || 'Erro ao fazer login.');
            } else {
                // Nunca armazene o token em localStorage sem criptografia!
                sessionStorage.setItem('token', data.token);
                localStorage.setItem('userEmail', data.user.email);
                localStorage.setItem('userName', data.user.name);
                navigate('/dashboard');
            }
        } catch (err) {
            setError('Erro de rede. Tente novamente mais tarde.');
        } finally {
            setLoading(false);
        }
    };

    // Render
    return ( <
        div className = "container" >
        <
        div className = "card" >
        <
        div className = "logo-icon" > ⚡ < /div> <
        h2 > Login < /h2>

        <
        form onSubmit = { handleSubmit }
        autoComplete = "off" >
        <
        label htmlFor = "email" > Email: < /label> <
        input id = "email"
        type = "email"
        placeholder = "Email"
        required value = { email }
        onChange = {
            (e) => setEmail(e.target.value)
        }
        aria - required = "true"
        autoFocus /
        >
        <
        label htmlFor = "password" > Senha: < /label> <
        input id = "password"
        type = "password"
        placeholder = "Senha"
        required value = { password }
        onChange = {
            (e) => setPassword(e.target.value)
        }
        aria - required = "true"
        minLength = { 6 }
        />

        {
            error && ( <
                div className = "error"
                role = "alert" > { error } <
                /div>
            )
        }

        <
        button type = "submit"
        disabled = { loading } > { loading ? 'Entrando...' : 'Entrar' } <
        /button> < /
        form >

        <
        Link to = "/create-account"
        className = "link-button" >
        Criar uma conta <
        /Link> < /
        div > <
        /div>
    );
}

export default LoginPage;