import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';
import icon from '../../public/icon.png';

function HomePage() {
    const navigate = useNavigate();

    // Carousel slides
    const slides = [
        'Bem-vindo ao Smart Energy!',
        'Reduza o desperdício e otimize sua energia doméstica com IoT.',
        'O futuro sustentável começa com a tecnologia ao seu alcance.',
        'Sustentabilidade inteligente na palma da sua mão.',
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

    return ( <
        div className = "homepage-container" >
        <
        header className = "homepage-header" >
        <
        div className = "homepage-navbar" >
        <
        button className = "homepage-btn"
        onClick = {
            () => navigate('/login')
        } >
        Login <
        /button> <
        button className = "homepage-btn homepage-btn-primary"
        onClick = { handleCreateAccount } >
        Criar Conta <
        /button> < /
        div >

        <
        div className = "homepage-title-row" >
        <
        img src = { icon }
        alt = "Ícone Smart Energy"
        className = "homepage-title-icon" / >
        <
        h1 className = "smart-energy-title" > Smart energy < /h1> < /
        div > <
        /header>

        <
        div className = "homepage-carousel" >
        <
        div className = "homepage-slide" > { slides[currentSlide] } <
        /div> <
        div className = "homepage-carousel-dots" > {
            slides.map((_, idx) => ( <
                span key = { idx }
                className = { idx === currentSlide ? 'dot active' : 'dot' }
                />
            ))
        } <
        /div> < /
        div > <
        /header>

        <
        main className = "homepage-main" >
        <
        section className = "homepage-card" >
        <
        h2 > Olá, eu sou Matheus Araújo < /h2> <
        p className = "homepage-intro" >
        Tenho 25 anos, sou estudante de Ciências da Computação é fudando da ferramenta!!. <
        /p> < /
        section >

        <
        section className = "homepage-card" >
        <
        h2 > Por que pensar em energia ? < /h2> <
        p >
        A energia está presente em praticamente todas as atividades do nosso dia a dia— ao acender uma luz, assistir à televisão, usar o computador ou carregar o celular.Mesmo em tarefas simples, ela é indispensável.
        Mas, em meio à rotina, surge uma pergunta essencial : como podemos utilizar esse recurso de maneira mais eficiente e sustentável a longo prazo ? Refletir sobre isso é o primeiro passo para um futuro com mais consciência, economia e respeito ao meio ambiente. <
        /p> < /
        section >

        <
        section className = "homepage-card" >
        <
        h2 > O que este sistema faz ? < /h2> <
        p >
        Descubra uma nova forma de cuidar do planeta e da sua casa.Este sistema online inovador, desenvolvido em formato de website, monitora o consumo de energia de dispositivos eletrônicos residenciais por meio da tecnologia IoT.
        Com uma estrutura baseada em segurança digital, bancos de dados inteligentes e metodologias modernas de software, ele oferece mais do que controle: promove eficiência, economia e consciência ambiental.
        Uma solução pensada para quem acredita que tecnologia e sustentabilidade devem caminhar juntas. <
        /p> < /
        section > <
        /main> < /
        div >
    );
}

export default HomePage;