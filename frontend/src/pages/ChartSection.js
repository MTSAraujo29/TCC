import React, { Suspense } from 'react';

const Line = React.lazy(() =>
    import('react-chartjs-2').then(mod => ({ default: mod.Line }))
);

const Doughnut = React.lazy(() =>
    import('react-chartjs-2').then(mod => ({ default: mod.Doughnut }))
);

function ChartSection({ chartData, doughnutData, viewMode, setViewMode }) {
    return (
        <section aria-label="Gráficos de consumo de energia">
            <h2>Gráficos</h2>

            <div>
                <button onClick={() => setViewMode('day')}>Dia</button>
                <button onClick={() => setViewMode('week')}>Semana</button>
                <button onClick={() => setViewMode('month')}>Mês</button>
            </div>

            <Suspense fallback={<div>Carregando gráfico...</div>}>
                <Line data={chartData} />
                <Doughnut data={doughnutData} />
            </Suspense>
        </section>
    );
}

export default React.memo(ChartSection);