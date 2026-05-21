
import React, { useState, useEffect, useRef } from 'react';
import { SpendingRecord } from '../types';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';
import CreditCardIcon from './icons/CreditCardIcon';

interface SpendingModalProps {
  isOpen: boolean;
  onClose: () => void;
  spendingRecords: SpendingRecord[];
  onSave: (record: SpendingRecord) => void;
  onDelete: (id: string) => void;
}

const SpendingModal: React.FC<SpendingModalProps> = ({ isOpen, onClose, spendingRecords, onSave, onDelete }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [view, setView] = useState<'list' | 'input'>('list');
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(new Date().toISOString().split('T')[0]);
      setAmount('');
      setMemo('');
      setView('list');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseInt(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    const newRecord: SpendingRecord = {
      id: Math.random().toString(36).substring(2, 9),
      date,
      amount: numAmount,
      memo: memo.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    onSave(newRecord);
    setAmount('');
    setMemo('');
    setView('list');
  };

  const sortedRecords = [...spendingRecords].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  // Today's total
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTotal = spendingRecords
    .filter(r => r.date === todayStr)
    .reduce((sum, r) => sum + r.amount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
      >
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
              <CreditCardIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white">使用金額の管理</h3>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">今日の支出: ¥{todayTotal.toLocaleString()}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl mb-6 shrink-0">
          <button 
            onClick={() => setView('list')} 
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            履歴一覧
          </button>
          <button 
            onClick={() => setView('input')} 
            className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${view === 'input' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            記録を入力
          </button>
        </div>

        <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
          {view === 'list' ? (
            <div className="space-y-3">
              {sortedRecords.length === 0 ? (
                <div className="text-center py-10 opacity-40">
                  <CreditCardIcon className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-xs font-bold">まだ記録がありません</p>
                </div>
              ) : (
                sortedRecords.map((record) => (
                  <div key={record.id} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 dark:text-white">{record.date}</p>
                      <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 mt-0.5">¥{record.amount.toLocaleString()}</p>
                      {record.memo && <p className="text-[10px] text-slate-400 font-medium truncate mt-1">{record.memo}</p>}
                    </div>
                    <button 
                      onClick={() => onDelete(record.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">日付</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">金額 (円)</label>
                  <input
                    type="number"
                    required
                    placeholder="例: 1000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">備考 (任意)</label>
                  <input
                    type="text"
                    placeholder="例: ○○店、乱獲"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-amber-200 dark:shadow-none hover:bg-amber-600 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                記録を保存する
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpendingModal;
