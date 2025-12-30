import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Defendant } from '../types';
import { calculateDaysDiff, THRESHOLD_IMPRISONMENT } from '../utils';
import { Filter } from 'lucide-react';

interface Props {
    defendants: Defendant[];
}

const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899'];

export const DashboardCharts: React.FC<Props> = ({ defendants }) => {
    const [prisonFilter, setPrisonFilter] = useState('Todos');

    // Filter Logic
    const uniquePrisons = useMemo(() => {
        const prisons = new Set(defendants.map(d => d.prison).filter(Boolean));
        return ['Todos', ...Array.from(prisons)];
    }, [defendants]);

    const filteredData = useMemo(() => {
        return prisonFilter === 'Todos'
            ? defendants
            : defendants.filter(d => d.prison === prisonFilter);
    }, [defendants, prisonFilter]);

    // Chart 1: Movement Types Distribution
    const movementStats = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredData.forEach(d => {
            const type = d.movementType || 'Não informado';
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 7); // Top 7
    }, [filteredData]);

    // Chart 2: Time Imprisoned Ranges
    const timeStats = useMemo(() => {
        let less30 = 0, less90 = 0, less365 = 0, more365 = 0;
        filteredData.forEach(d => {
            const days = calculateDaysDiff(d.arrestDate);
            if (days <= 30) less30++;
            else if (days <= 90) less90++;
            else if (days <= 365) less365++;
            else more365++;
        });
        return [
            { name: '< 30 dias', value: less30 },
            { name: '30-90 dias', value: less90 },
            { name: '3-12 meses', value: less365 },
            { name: '> 1 ano', value: more365 },
        ];
    }, [filteredData]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Filters Toolbar */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center gap-4">
                <div className="flex items-center gap-2 text-gray-700 font-medium">
                    <Filter size={20} />
                    <span>Filtros do Painel:</span>
                </div>
                <select
                    value={prisonFilter}
                    onChange={(e) => setPrisonFilter(e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-justice-500 outline-none"
                >
                    {uniquePrisons.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="text-sm text-gray-500 ml-auto">
                    Baseado em {filteredData.length} registros
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Chart 1 */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-justice-500 pl-3">Distribuição por Movimentação (Top 7)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={movementStats}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {movementStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2 */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-orange-500 pl-3">Tempo de Prisão Provisória</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeStats} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip cursor={{ fill: '#f3f4f6' }} />
                                <Bar dataKey="value" name="Qtd. Réus" fill="#0ea5e9" radius={[0, 4, 4, 0]}>
                                    {timeStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 3 ? '#ef4444' : '#0ea5e9'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
};
