// frontend/src/pages/CreateAccountPage.js
import React, { useState } from 'react'; // Hook de estado
import { Link, useNavigate } from 'react-router-dom'; // Navegação e link
import '../App.css'; // CSS global
import { API_ENDPOINTS } from '../config/api';

function CreateAccountPage() {
    const navigate = useNavigate();

    // Estados para armazenar os valores dos inputs
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(''); // Estado para mensagens de erro

    const handleSubmit = async(e) => {
        e.preventDefault();
        setError(''); // Limpa mensagens de erro anteriores

        if (password !== confirmPassword) {
            setError('As senhas não coincidem!');
            return;
        }

        console.log('Tentando criar conta com:', { name, email, password });

        try {
            const response = await fetch(API_ENDPOINTS.REGISTER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Conta criada com sucesso:', data);
                alert('Sua conta foi criada com sucesso! Faça login agora.');
                navigate('/login'); // Redireciona para a página de login
            } else {
                // Erro do backend
                console.error('Erro ao criar conta:', data.message || 'Erro desconhecido');
                setError(data.message || 'Erro ao criar conta. Tente novamente.');
            }
        } catch (err) {
            // Erro de rede
            console.error('Erro de rede ao criar conta:', err);
            setError('Não foi possível conectar ao servidor. Verifique sua conexão ou tente mais tarde.');
        }
    };

    return ( <
        div className = "container" >
        <
        div className = "card" >
        <
        div className = "logo-icon" > ⚡ < /div> {/ * Ícone simples * /} <
        h2 > Criar Conta < /h2>

        <
        form onSubmit = { handleSubmit } >
        <
        input type = "text"
        placeholder = "Nome"
        required value = { name }
        onChange = {
            (e) => setName(e.target.value)
        }
        /> <
        input type = "email"
        placeholder = "Email"
        required value = { email }
        onChange = {
            (e) => setEmail(e.target.value)
        }
        /> <
        input type = "password"
        placeholder = "Senha"
        required value = { password }
        onChange = {
            (e) => setPassword(e.target.value)
        }
        /> <
        input type = "password"
        placeholder = "Confirmar Senha"
        required value = { confirmPassword }
        onChange = {
            (e) => setConfirmPassword(e.target.value)
        }
        />

        {
            error && ( <
                p style = {
                    { color: 'red', fontSize: '0.9em' }
                } > { error } <
                /p>
            )
        }

        <
        button type = "submit" > Criar < /button> < /
        form >

        <
        Link to = "/"
        className = "link-button" >
        Voltar para login <
        /Link> < /
        div > <
        /div>
    );
}

export default CreateAccountPage;