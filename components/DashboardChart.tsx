
import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

interface ChartDataPoint {
  date: string;
  [key: string]: any;
}

interface DashboardChartProps {
  data: ChartDataPoint[];
  title: string;
  items: {
    key: string;
    label: string;
    color: string;
  }[];
  yAxisFormatter?: (value: number) => string;
  unit?: string;
}

const DashboardChart: React.FC<DashboardChartProps> = ({ 
  data, 
  title, 
  items,
  yAxisFormatter = (val) => val.toLocaleString(),
  unit = ""
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className="w-full h-64 sm:h-80 bg-white dark:bg-slate-800 rounded-[2rem] p-4 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">{title}</h3>
        <div className="flex gap-4">
          {items.map(item => (
            <div key={item.key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-[10px] font-bold text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {items.map(item => (
              <linearGradient key={`grad-${item.key}`} id={`color-${item.key}`} x1="0" y1="0" x2="0" y2="100%">
                <stop offset="5%" stopColor={item.color} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={item.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatDate}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
            minTickGap={30}
          />
          <YAxis 
            tickFormatter={yAxisFormatter}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
            width={unit === "円" ? 65 : 30}
            domain={[0, 'auto']}
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(30, 41, 59, 0.95)', 
              backdropFilter: 'blur(8px)',
              border: 'none', 
              borderRadius: '1.25rem',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              padding: '16px'
            }}
            itemStyle={{ padding: '4px 0' }}
            cursor={{ stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '4 4' }}
            formatter={(value: number, name: string) => {
              return [
                <span style={{ color: '#fff', fontWeight: 800 }}>
                  {yAxisFormatter(value)}{unit}
                </span>,
                <span style={{ color: '#94a3b8', marginRight: '8px' }}>{name}</span>
              ];
            }}
            labelFormatter={(label) => {
              const d = new Date(label);
              return (
                <span className="block text-indigo-300 text-[10px] uppercase tracking-widest mb-2 font-black">
                  {d.getFullYear()}年 {d.getMonth() + 1}月 {d.getDate()}日
                </span>
              );
            }}
          />
          {items.map(item => (
            <Area 
              key={item.key}
              type="monotone" 
              dataKey={item.key} 
              stroke={item.color} 
              strokeWidth={3}
              fillOpacity={1} 
              fill={`url(#color-${item.key})`} 
              name={item.label}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DashboardChart;
