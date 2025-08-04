/**
 * Página Inicial (Landing Page)
 * 
 * Página de apresentação do sistema Smart Energy com:
 * - Carrossel automático de mensagens
 * - Navegação para login/registro
 * - Informações sobre o projeto e desenvolvedor
 * - Design responsivo e moderno
 * 
 * @module HomePage
 * @requires react
 * @requires react-router-dom
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
    const navigate = useNavigate();
    const [currentSlide, setCurrentSlide] = React.useState(0);

    // === CONFIGURAÇÕES ===
    const CAROUSEL_INTERVAL = 3500; // Intervalo do carrossel em ms
    
    // Mensagens do carrossel rotativo
    const slides = [
        'Bem-vindo ao Smart Energy!',
        'Reduza o desperdício e otimize sua energia doméstica com IoT.',
        'O futuro sustentável começa com a tecnologia ao seu alcance.',
        'Sustentabilidade inteligente na palma da sua mão.',
    ];

    // === EFEITOS ===
    // Carrossel automático de slides
    React.useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, CAROUSEL_INTERVAL);
        
        return () => clearInterval(interval);
    }, [slides.length]);

    // === HANDLERS DE NAVEGAÇÃO ===
    
    /**
     * Navega para página de criação de conta
     * Inclui flag para auto-login após registro
     */
    const handleCreateAccount = () => {
        navigate('/create-account', { state: { autoLogin: true } });
    };

    /**
     * Navega para página de login
     */
    const handleNavigateToLogin = () => {
        navigate('/login');
    };

    // === COMPONENTES DE RENDERIZAÇÃO ===
    
    /**
     * Renderiza cabeçalho com logo e nome do sistema
     */
    const renderHeader = () => (
        <div className="nome">
            <img src="/icon.png" alt="Ícone Smart Energy" className="icone" />
            <h1>Smart Energy</h1>
        </div>
    );

    /**
     * Renderiza botões de navegação principais
     */
    const renderNavButtons = () => (
        <div className="homepage-navbar">
            <button className="homepage-btn" onClick={handleNavigateToLogin}>
                Entrar
            </button>
            <button
                className="homepage-btn homepage-btn-primary"
                onClick={handleCreateAccount}
            >
                Criar Conta
            </button>
        </div>
    );

    /**
     * Renderiza carrossel de mensagens com indicadores
     */
    const renderCarousel = () => (
        <div className="homepage-carousel">
            <div className="homepage-slide">
                {slides[currentSlide]}
            </div>
            <div className="homepage-carousel-dots">
                {slides.map((_, idx) => (
                    <span
                        key={idx}
                        className={idx === currentSlide ? 'dot active' : 'dot'}
                        aria-label={`Slide ${idx + 1}`}
                    />
                ))}
            </div>
        </div>
    );

    /**
     * Renderiza conteúdo principal com informações do projeto
     */
    const renderMainContent = () => (
        <main className="homepage-main">
            {/* Seção de apresentação pessoal */}
            <section className="homepage-card">
                <h2>Olá, eu sou Matheus Araújo</h2>
                <p className="homepage-intro">
                    Tenho 25 anos, sou estudante de Ciências da Computação e fundador desta ferramenta!
                </p>
            </section>

            {/* Seção sobre importância da energia */}
            <section className="homepage-card">
                <h2>Por que pensar em energia?</h2>
                <p>
                    A energia está presente em praticamente todas as atividades do nosso dia a dia — ao acender uma luz, 
                    assistir à televisão, usar o computador ou carregar o celular. Mesmo em tarefas simples, ela é indispensável.
                    Mas, em meio à rotina, surge uma pergunta essencial: como podemos utilizar esse recurso de maneira mais 
                    eficiente e sustentável a longo prazo? Refletir sobre isso é o primeiro passo para um futuro com mais 
                    consciência, economia e respeito ao meio ambiente.
                </p>
            </section>

            {/* Seção sobre funcionalidades do sistema */}
            <section className="homepage-card">
                <h2>O que este sistema faz?</h2>
                <p>
                    Descubra uma nova forma de cuidar do planeta e da sua casa. Este sistema online, desenvolvido em formato 
                    de website, monitora o consumo de energia de dispositivos eletrônicos residenciais por meio da tecnologia IoT.
                    Com uma estrutura baseada em segurança digital, bancos de dados inteligentes e metodologias modernas de 
                    software, ele oferece mais do que controle: promove eficiência, economia e consciência ambiental.
                    Uma solução pensada para quem acredita que tecnologia e sustentabilidade devem caminhar juntas.
                </p>
            </section>
        </main>
    );

    // === RENDERIZAÇÃO PRINCIPAL ===
    return (
        <div className="homepage-container">
            <header className="homepage-header">
                {renderHeader()}
                {renderNavButtons()}
                {renderCarousel()}
            </header>

            {renderMainContent()}
        </div>
    );
}

export default HomePage;