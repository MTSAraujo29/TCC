import React from 'react';

function Sidebar({ activeSection, setActiveSection, isMobileMenuOpen, setIsMobileMenuOpen }) {
    const menuItems = [
        { id: 'inicio', label: 'Início' },
        { id: 'dispositivos', label: 'Dispositivos' },
        { id: 'graficos', label: 'Gráficos' },
        { id: 'conta', label: 'Conta' }
    ];

    return (
        <aside
            className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}
            role="navigation"
            aria-label="Menu lateral"
        >
            <button
                className="sidebar-toggle"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Alternar menu"
                aria-expanded={isMobileMenuOpen}
            >
                ☰
            </button>

            <nav>
                <ul>
                    {menuItems.map((item) => (
                        <li key={item.id} className={activeSection === item.id ? 'active' : ''}>
                            <button onClick={() => setActiveSection(item.id)}>
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
}

export default React.memo(Sidebar);