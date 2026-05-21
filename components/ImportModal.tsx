
import React from 'react';
import { Prize } from '../types';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  prizes: Prize[];
  onConfirm: (mode: 'append' | 'replace') => void;
  importType: 'json' | 'csv' | 'code';
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, prizes, onConfirm, importType }) => {
  if (!isOpen) return null;

  const summary = {
    count: prizes.length,
    totalQuantity: prizes.reduce((sum, p) => sum + p.quantity, 0),
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">インポートの確認</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">以下のデータをインポートの準備ができました</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto space-y-6 pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">アイテム数</p>
              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{summary.count} 種類</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">在庫総数</p>
              <p className="text-lg font-black text-slate-800 dark:text-white">{summary.totalQuantity} 個</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">データプレビュー (最大5件)</p>
            <div className="space-y-2">
              {prizes.slice(0, 5).map((p, i) => (
                <div key={p.id || i} className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0 overflow-hidden">
                    {p.photo ? (
                      <img src={p.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-black truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold">{p.category} • {p.manufacturer || 'その他'}</p>
                  </div>
                </div>
              ))}
              {prizes.length > 5 && (
                <p className="text-center text-[10px] font-bold text-slate-400 italic">他 {prizes.length - 5} 件...</p>
              )}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800/50">
            <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              警告: 同期方法の選択
            </h4>
            <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-bold">
              「完全置換」を選択すると、現在アプリに保存されている<span className="underline decoration-2">すべてのデータが失われ</span>、インポートするデータに置き換わります。「追加する」を選択すると、現在のデータを保持したまま新しいアイテムとして追加されます。
            </p>
          </div>
        </div>

        <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <button
            onClick={() => onConfirm('append')}
            className="flex items-center justify-center gap-2 py-4 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-sm hover:bg-slate-200 transition-all active:scale-[0.98]"
          >
            <PlusIcon className="w-4 h-4" />
            現在のデータに追加
          </button>
          <button
            onClick={() => {
              if (confirm('警告：現在の全データが削除され、インポートした内容で上書きされます。よろしいですか？')) {
                onConfirm('replace');
              }
            }}
            className="flex items-center justify-center gap-2 py-4 bg-red-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-700 transition-all active:scale-[0.98]"
          >
            <TrashIcon className="w-4 h-4" />
            完全に置き換える
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
