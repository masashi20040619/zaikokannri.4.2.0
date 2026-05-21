
import React, { useState, useMemo } from 'react';
import { Prize, HistoryRecord } from '../types';
import TrashIcon from './icons/TrashIcon';
import SearchIcon from './icons/SearchIcon';

interface HistoryManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  prizes: Prize[];
  onDeleteHistory: (prizeId: string, historyId: string) => void;
}

const HistoryManagementModal: React.FC<HistoryManagementModalProps> = ({
  isOpen,
  onClose,
  prizes,
  onDeleteHistory
}) => {
  const [filterType, setFilterType] = useState<'all' | 'stock' | 'sell'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingRecord, setDeletingRecord] = useState<{ prizeId: string, historyId: string } | null>(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  const allHistory = useMemo(() => {
    const records: { prizeName: string, prizeId: string, record: HistoryRecord }[] = [];
    prizes.forEach(prize => {
      prize.history?.forEach(h => {
        if (h.type === 'stock' || h.type === 'sell' || h.type === 'buy') {
          records.push({
            prizeName: prize.name,
            prizeId: prize.id,
            record: h
          });
        }
      });
    });
    return records.sort((a, b) => new Date(b.record.timestamp).getTime() - new Date(a.record.timestamp).getTime());
  }, [prizes]);

  const filteredHistory = useMemo(() => {
    return allHistory.filter(item => {
      const typeMatch = filterType === 'all' || item.record.type === filterType;
      const nameMatch = item.prizeName.toLowerCase().includes(searchTerm.toLowerCase());
      return typeMatch && nameMatch;
    });
  }, [allHistory, filterType, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-4xl h-[80vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">履歴管理</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">仕入れ・売却履歴の確認と削除</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row gap-4 shrink-0">
          <div className="relative flex-grow">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="景品名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button 
              onClick={() => setFilterType('all')} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
            >
              すべて
            </button>
            <button 
              onClick={() => setFilterType('stock')} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'stock' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400'}`}
            >
              仕入れ
            </button>
            <button 
              onClick={() => setFilterType('sell')} 
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'sell' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400'}`}
            >
              売却
            </button>
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 custom-scrollbar">
          <table className="w-full text-sm text-left text-slate-500 dark:text-slate-400">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50 dark:bg-slate-700 dark:text-slate-300 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">日時</th>
                <th className="px-4 py-3">種別</th>
                <th className="px-4 py-3">景品名</th>
                <th className="px-4 py-3 text-center">数量</th>
                <th className="px-4 py-3 text-right">単価</th>
                <th className="px-4 py-3 text-right">合計</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center text-slate-400 font-bold">履歴が見つかりません</td>
                </tr>
              ) : (
                filteredHistory.map(({ prizeName, prizeId, record }) => (
                  <tr key={record.id} className="border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-4 whitespace-nowrap text-xs">
                      {new Date(record.timestamp).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${record.type === 'stock' || record.type === 'buy' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                        {record.type === 'stock' || record.type === 'buy' ? '仕入れ' : '売却'}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-800 dark:text-white truncate max-w-[150px]">
                      {prizeName}
                    </td>
                    <td className="px-4 py-4 text-center font-mono">
                      {record.quantity}
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      ¥{(record.unitPrice || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-black text-slate-800 dark:text-white font-mono">
                      ¥{((record.quantity || 0) * (record.unitPrice || 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => setDeletingRecord({ prizeId, historyId: record.id })}
                          className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-red-500 rounded-lg transition-colors"
                          title="削除"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {deletingRecord && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[80] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrashIcon className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white text-center mb-2">履歴を削除しますか？</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-8 font-bold">
                この操作は取り消せません。<br />在庫数も自動的に調整されます。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingRecord(null)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    onDeleteHistory(deletingRecord.prizeId, deletingRecord.historyId);
                    setDeletingRecord(null);
                    setShowDeleteSuccess(true);
                    setTimeout(() => setShowDeleteSuccess(false), 2000);
                  }}
                  className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black text-sm shadow-lg shadow-red-200 dark:shadow-none"
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteSuccess && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[90] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2">
              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
              </div>
              <span className="text-sm font-black">履歴を削除しました</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryManagementModal;
