import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
    const navigate = useNavigate();

    // Carousel slides
    const slides = [
        'Bem-vindo ao Smart Energy!',
        'Otimize o consumo de energia da sua casa com IoT',
        'Sustentabilidade e tecnologia ao seu alcance',
    ];

    const [currentSlide, setCurrentSlide] = React.useState(0);

    // Auto-advance carousel
    React.useEffect(() => {
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 3500);
        return () => clearInterval(interval);
    }, [slides.length]);

    const handleCreateAccount = () => {
        navigate('/create-account', { state: { autoLogin: true } });
    };

    return (
        <div className="homepage-container">
            <header className="homepage-header">
                <div className="homepage-navbar">
                    <button
                        className="homepage-btn"
                        onClick={() => navigate('/login')}
                    >
                        Login
                    </button>
                    <button
                        className="homepage-btn homepage-btn-primary"
                        onClick={handleCreateAccount}
                    >
                        Criar Conta
                    </button>
                </div>

                <div className="homepage-carousel">
                    <div className="homepage-slide">
                        {slides[currentSlide]}
                    </div>
                    <div className="homepage-carousel-dots">
                        {slides.map((_, idx) => (
                            <span
                                key={idx}
                                className={idx === currentSlide ? 'dot active' : 'dot'}
                            />
                        ))}
                    </div>
                </div>
            </header>

            <main className="homepage-main">
                <section className="homepage-card">
                    <h2>Olá, eu sou Matheus Araújo</h2>
                    <p className="homepage-intro">
                        25 anos, estudante de Ciências da Computação.
                    </p>
                </section>

                <section className="homepage-card">
                    <h2>Por que pensar em energia?</h2>
                    <p>
                        A energia está presente em praticamente tudo o que se faz, seja quando uma luz é acesa em um local, se assiste à televisão, se usa um computador, ou se utiliza um celular, entre outras coisas do cotidiano. No entanto, em meio às ações cotidianas, surge uma questão fundamental: como podemos aproveitar esse recurso de forma mais eficaz e sustentável ao longo prazo?
                    </p>
                </section>

                <section className="homepage-card">
                    <h2>O que este sistema faz?</h2>
                    <p>
                        Este é um sistema online, em formato de website, que integra dados de consumo de energia de dispositivos eletrônicos residenciais, coletados através de tecnologia IoT. A implementação do sistema utiliza metodologias de desenvolvimento de software, protocolos de criptografia e sistemas de gerenciamento de banco de dados, com o intuito de otimizar o consumo energético e fomentar práticas sustentáveis.
                    </p>
                </section>
            </main>
        </div>
    );
}

export default HomePage;