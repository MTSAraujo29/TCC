import React from 'react';

function Sidebar({ activeSection, setActiveSection, isMobileMenuOpen, setIsMobileMenuOpen }) {
    return ( <
        aside className = { `sidebar ${isMobileMenuOpen ? 'open' : ''}` }
        role = "navigation"
        aria - label = "Menu lateral" >
        <
        button className = "sidebar-toggle"
        onClick = {
            () => setIsMobileMenuOpen(!isMobileMenuOpen)
        }
        aria - label = "Alternar menu" > ☰
        <
        /button> <
        nav >
        <
        ul >
        <
        li className = { activeSection === 'inicio' ? 'active' : '' } >
        <
        button onClick = {
            () => setActiveSection('inicio')
        } > Início < /button> < /
        li > <
        li className = { activeSection === 'dispositivos' ? 'active' : '' } >
        <
        button onClick = {
            () => setActiveSection('dispositivos')
        } > Dispositivos < /button> < /
        li > <
        li className = { activeSection === 'graficos' ? 'active' : '' } >
        <
        button onClick = {
            () => setActiveSection('graficos')
        } > Gráficos < /button> < /
        li > <
        li className = { activeSection === 'conta' ? 'active' : '' } >
        <
        button onClick = {
            () => setActiveSection('conta')
        } > Conta < /button> < /
        li > <
        /ul> < /
        nav > <
        /aside>
    );
}

export default React.memo(Sidebar);