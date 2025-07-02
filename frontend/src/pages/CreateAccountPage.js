import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../App.css';
import { API_ENDPOINTS } from '../config/api';

function CreateAccountPage() {
    // Hooks
    const navigate = useNavigate();

    // State management
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'name') {
            setName(value);
        } else if (name === 'email') {
            setEmail(value);
        } else if (name === 'password') {
            setPassword(value);
        }
    };

    function validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // Form submission handler
    const handleSubmit = async(e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!name.trim()) {
            setError('O nome é obrigatório.');
            return;
        }
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
            const response = await fetch(API_ENDPOINTS.REGISTER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), password: password })
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.message || (data.errors && data.errors[0] ? .msg) || 'Erro ao criar conta.');
            } else {
                setSuccess('Conta criada com sucesso! Faça login para continuar.');
                setName('');
                setEmail('');
                setPassword('');
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
        h2 > Criar Conta < /h2>

        <
        form onSubmit = { handleSubmit }
        autoComplete = "off" >
        <
        label htmlFor = "name" > Nome: < /label> <
        input id = "name"
        type = "text"
        name = "name"
        placeholder = "Nome"
        required value = { name }
        onChange = { handleInputChange }
        aria - required = "true"
        autoFocus /
        >
        <
        label htmlFor = "email" > Email: < /label> <
        input id = "email"
        type = "email"
        name = "email"
        placeholder = "Email"
        required value = { email }
        onChange = { handleInputChange }
        aria - required = "true" /
        >
        <
        label htmlFor = "password" > Senha: < /label> <
        input id = "password"
        type = "password"
        name = "password"
        placeholder = "Senha"
        required value = { password }
        onChange = { handleInputChange }
        aria - required = "true"
        minLength = { 6 }
        />

        {
            error && ( <
                div className = "error"
                role = "alert" > { error } <
                /div>
            )
        } {
            success && ( <
                div className = "success"
                role = "status" > { success } <
                /div>
            )
        }

        <
        button type = "submit"
        disabled = { loading } > { loading ? 'Criando...' : 'Criar' } <
        /button> < /
        form >

        <
        Link to = "/"
        className = "link-button" >
        Voltar Tela Inicial <
        /Link> < /
        div > <
        /div>
    );
}

export default CreateAccountPage;