
import React, { useState, useMemo } from 'react';
import { SpendingRecord } from '../types';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';

interface ExpenseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: SpendingRecord[];
  onSaveExpense: (expense: SpendingRecord) => void;
  onDeleteExpense: (id: string) => void;
}

const ExpenseManagementModal: React.FC<ExpenseManagementModalProps> = ({
  isOpen,
  onClose,
  expenses,
  onSaveExpense,
  onDeleteExpense
}) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const sortedExpenses = useMemo(() => {
    return [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses]);

  const totalAmount = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const handleAdd = () => {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('有効な金額を入力してください。');
      return;
    }

    onSaveExpense({
      id: Math.random().toString(36).substr(2, 9),
      date,
      amount: numAmount,
      memo,
      createdAt: new Date().toISOString()
    });

    setAmount('');
    setMemo('');
    setIsAdding(false);
  };

  const executeDelete = () => {
    if (deleteConfirmId) {
      onDeleteExpense(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">支出管理</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">日別の支出（仕入れコスト）を記録</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
          {/* Summary Card */}
          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-1">支出総額</div>
            <div className="text-3xl font-black">¥{totalAmount.toLocaleString()}</div>
          </div>

          {/* Add Form */}
          {!isAdding ? (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-500 transition-all font-black text-sm"
            >
              <PlusIcon className="w-5 h-5" />
              新しい支出を追加
            </button>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl space-y-4 animate-in slide-in-from-top-4 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">日付</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-white dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">金額</label>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="金額を入力"
                    className="w-full mt-1 px-4 py-3 bg-white dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">メモ（任意）</label>
                <input 
                  type="text" 
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="例: 〇〇ゲームセンター"
                  className="w-full mt-1 px-4 py-3 bg-white dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsAdding(false)}
                  className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleAdd}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 dark:shadow-none"
                >
                  追加する
                </button>
              </div>
            </div>
          )}

          {/* List */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">支出履歴</h4>
            {sortedExpenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-bold text-sm">
                支出データがありません
              </div>
            ) : (
              <div className="space-y-3">
                {sortedExpenses.map((expense) => (
                  <div 
                    key={expense.id}
                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-xl flex flex-col items-center justify-center shrink-0">
                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none">{expense.date.split('-')[1]}月</span>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none mt-0.5">{expense.date.split('-')[2]}</span>
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800 dark:text-white">¥{expense.amount.toLocaleString()}</div>
                        {expense.memo && (
                          <div className="text-[10px] font-bold text-slate-400">{expense.memo}</div>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => setDeleteConfirmId(expense.id)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xs rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <TrashIcon className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-white text-center mb-2">支出を削除しますか？</h3>
            <p className="text-xs font-bold text-slate-400 text-center mb-8">この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={executeDelete}
                className="flex-1 py-3 bg-red-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-red-200 dark:shadow-none"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseManagementModal;
