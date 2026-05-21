
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Prize, PrizeCategory, Manufacturer, SpendingRecord } from './types';
import PrizeCard from './components/PrizeCard';
import PrizeFormModal from './components/PrizeFormModal';
import PlusIcon from './components/icons/PlusIcon';
import SearchIcon from './components/icons/SearchIcon';
import PrizeList from './components/PrizeList';
import Squares2x2Icon from './components/icons/Squares2x2Icon';
import QueueListIcon from './components/icons/QueueListIcon';
import CheckCircleIcon from './components/icons/CheckCircleIcon';
import ArrowPathIcon from './components/icons/ArrowPathIcon';
import SaveIcon from './components/icons/SaveIcon';
import CogIcon from './components/icons/CogIcon';
import ArrowDownTrayIcon from './components/icons/ArrowDownTrayIcon';
import ArrowUpTrayIcon from './components/icons/ArrowUpTrayIcon';
import TrashIcon from './components/icons/TrashIcon';
import ArchiveBoxIcon from './components/icons/ArchiveBoxIcon';
import CreditCardIcon from './components/icons/CreditCardIcon';
import HomeIcon from './components/icons/HomeIcon';
import ClockIcon from './components/icons/ClockIcon';
import { StorageService } from './services/storage';
import PriceHistoryChart from './components/PriceHistoryChart';
import PrizeDetailModal from './components/PrizeDetailModal';
import DashboardChart from './components/DashboardChart';
import { CsvService } from './services/csvService';
import ImportModal from './components/ImportModal';
import SpendingModal from './components/SpendingModal';
import DocumentTextIcon from './components/icons/DocumentTextIcon';
import HistoryManagementModal from './components/HistoryManagementModal';

const prizeCategories: PrizeCategory[] = ['マスコット', 'ぬいぐるみ', 'フィギュア', '雑貨', 'その他'];
const prizeManufacturers: Manufacturer[] = [
  'バンダイナムコ',
  'タイトー',
  'SEGA FAVE',
  'FuRyu',
  'Parade',
  'SK',
  'SYSTEM SERVICE',
  'EIKOH',
  'その他'
];

type DisplayMode = 'card' | 'list';
type SortOrder = 'date-desc' | 'name-asc' | 'name-desc';
type TabType = 'home' | 'inventory' | 'add' | 'history' | 'data';

function parseLastNumber(text: string): number | null {
  const m = text.match(/(-?\d+)(?!.*-?\d+)/);
  return m ? Number(m[1]) : null;
}

/** 履歴同期用（内容が変わったときだけ親 state を更新する） */
function historyContentKey(p: Prize): string {
  return JSON.stringify(
    (p.history ?? []).map(h => [h.id, h.timestamp, h.action, h.type, h.quantity, h.unitPrice, h.price])
  );
}

function ensureHistoryIds(prize: Prize): Prize {
  const hist = prize.history;
  if (!hist?.length) return prize;
  let changed = false;
  const nextHist = hist.map(h => {
    if (h.id && String(h.id).length > 0) return h;
    changed = true;
    return { ...h, id: Math.random().toString(36).substring(2, 11) };
  });
  return changed ? { ...prize, history: nextHist } : prize;
}

function deriveQuantityFromHistory(prize: Prize): number {
  const history = prize.history || [];
  if (history.length === 0) return prize.quantity;

  const sorted = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // 最後の「新規登録」を在庫の起点にする（それより前の売買は無視＝削除済みと整合）
  let lastRegIdx = -1;
  let base = prize.quantity ?? 0;
  for (let i = 0; i < sorted.length; i++) {
    const h = sorted[i];
    if (h.action === 'registration') {
      lastRegIdx = i;
      if (typeof h.quantity === 'number') base = h.quantity;
      else {
        const n = parseLastNumber(h.details);
        base = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
      }
    }
  }

  let q = base;
  const startIdx = lastRegIdx < 0 ? 0 : lastRegIdx + 1;
  for (let i = startIdx; i < sorted.length; i++) {
    const h = sorted[i];
    if (h.action === 'quantity_change') {
      if (typeof h.quantity === 'number') q = h.quantity;
      else {
        const n = parseLastNumber(h.details);
        if (typeof n === 'number' && !Number.isNaN(n)) q = n;
      }
      continue;
    }

    const isSale = h.type === 'sell' || h.action === 'sale';
    const isBuy = h.type === 'buy' || h.type === 'stock' || h.action === 'acquisition';
    if (isSale) q -= (h.quantity || 1);
    if (isBuy) q += (h.quantity || 1);
  }
  return Math.max(0, q);
}

function recalcAllFromHistory(prizes: Prize[]): Prize[] {
  return prizes.map(p => {
    const withIds = ensureHistoryIds(p);
    return { ...withIds, quantity: deriveQuantityFromHistory(withIds) };
  });
}

const App: React.FC = () => {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [spendingRecords, setSpendingRecords] = useState<SpendingRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpendingModalOpen, setIsSpendingModalOpen] = useState(false);
  const [prizeToEdit, setPrizeToEdit] = useState<Prize | null>(null);
  const [historyPrize, setHistoryPrize] = useState<Prize | null>(null);
  const [detailPrize, setDetailPrize] = useState<Prize | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PrizeCategory | 'すべて'>('すべて');
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | 'すべて'>('すべて');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('card');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date-desc');
  const [statsDays, setStatsDays] = useState<number>(1);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'sell' | 'buy' | 'spending'>('all');
  
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showTools, setShowTools] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCodeImportOpen, setIsCodeImportOpen] = useState(false);
  const [isHistoryManagementOpen, setIsHistoryManagementOpen] = useState(false);
  const [importCode, setImportCode] = useState('');
  const [importConfirmData, setImportConfirmData] = useState<Prize[] | null>(null);
  const [currentImportType, setCurrentImportType] = useState<'json' | 'csv' | 'code'>('json');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importTextAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleExportJson = useCallback(() => {
    try {
      const exportData = {
        prizes,
        spendingRecords
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const exportFileDefaultName = `crane_stock_backup_${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      // クリーンアップ
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Export failed:", error);
      alert('エクスポートに失敗しました。データが大きすぎる可能性があります。');
    }
  }, [prizes]);

  const handleExportCsv = useCallback(() => {
    try {
      CsvService.exportToCsv(prizes);
    } catch (error) {
      console.error("CSV Export failed:", error);
      alert('CSVエクスポートに失敗しました。');
    }
  }, [prizes]);

  // Warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const processImportedData = useCallback(async (rawJson: any, type: 'json' | 'csv' | 'code') => {
    try {
      // 互換性チェック：トップレベルが配列なら旧送式（prizesのみ）、オブジェクトなら新形式
      let importedPrizes: any[] = [];
      let importedSpending: any[] = [];

      if (Array.isArray(rawJson)) {
        importedPrizes = rawJson;
      } else if (rawJson && typeof rawJson === 'object') {
        importedPrizes = Array.isArray(rawJson.prizes) ? rawJson.prizes : [];
        importedSpending = Array.isArray(rawJson.spendingRecords) ? rawJson.spendingRecords : [];
      }

      setCurrentImportType(type);
      
      // 景品データの正規化
      const normalizedPrizes: Prize[] = importedPrizes
        .filter((item: any) => item && typeof item === 'object' && (item.id || item.name))
        .map((item: any) => {
          const id = String(item.id || Math.random().toString(36).substr(2, 9));
          let history = item.history || [{
            timestamp: new Date().toISOString(),
            action: 'import',
            details: `${type.toUpperCase()}からインポートされました`
          }];
          
          history = history.map((h: any) => {
            if (h.type === 'stock') {
              return { ...h, type: 'buy' };
            }
            return h;
          });
          
          return {
            ...item,
            id,
            name: String(item.name || '名称未設定'),
            quantity: Number(item.quantity) || 0,
            acquisitionDate: item.acquisitionDate || new Date().toISOString().split('T')[0],
            category: (prizeCategories.includes(item.category) ? item.category : 'その他') as PrizeCategory,
            manufacturer: (prizeManufacturers.includes(item.manufacturer) ? item.manufacturer : 'その他') as Manufacturer,
            history
          };
        });

      // 使用金額データの正規化
      const normalizedSpending: SpendingRecord[] = importedSpending
        .filter((item: any) => item && typeof item === 'object' && item.amount)
        .map((item: any) => ({
          id: String(item.id || Math.random().toString(36).substring(2, 9)),
          date: item.date || new Date().toISOString().split('T')[0],
          amount: Number(item.amount) || 0,
          memo: item.memo,
          createdAt: item.createdAt || new Date().toISOString()
        }));

      if (normalizedPrizes.length === 0 && normalizedSpending.length === 0) {
        alert('有効なデータが見つかりませんでした。');
        return;
      }

      // インポート確認用に保持
      setImportConfirmData(normalizedPrizes);
      // インポート用の一時的な使用金額データもstateに持たせるか、直接finalizeに渡す必要があるが
      // ここでは簡易的に現在のインポート処理の流れに乗せる
      // （※本来は SpendingRecord も確認画面に出すべきだが、一旦 prized を優先）
      (window as any).__tempSpendingImport = normalizedSpending;

      setIsImportModalOpen(true);
      setIsCodeImportOpen(false);
    } catch (error) {
      console.error("Import processing error:", error);
      alert('データの処理中にエラーが発生しました。');
    }
  }, []);

  const finalizeImport = useCallback(async (mode: 'append' | 'replace') => {
    if (!importConfirmData) return;

    try {
      let nextPrizes: Prize[];
      let nextSpending: SpendingRecord[];
      const importedSpending = (window as any).__tempSpendingImport as SpendingRecord[] || [];
      
      if (mode === 'replace') {
        nextPrizes = importConfirmData;
        nextSpending = importedSpending;
      } else {
        // 追加の場合：既存に統合
        const existingPrizeMap = new Map<string, Prize>(prizes.map(p => [p.id, p]));
        importConfirmData.forEach(item => {
          existingPrizeMap.set(item.id, item);
        });
        nextPrizes = Array.from(existingPrizeMap.values());

        const existingSpendingMap = new Map<string, SpendingRecord>(spendingRecords.map(s => [s.id, s]));
        importedSpending.forEach(item => {
          existingSpendingMap.set(item.id, item);
        });
        nextSpending = Array.from(existingSpendingMap.values());
      }

      setPrizes(nextPrizes);
      setSpendingRecords(nextSpending);
      setIsDirty(true);
      setImportConfirmData(null);
      delete (window as any).__tempSpendingImport;
      setIsImportModalOpen(false);
      setImportCode('');
      
      alert(mode === 'replace' ? 'データを完全に置き換えました。右上の「保存」ボタンから保存してください。' : '既存データに統合しました。右上の「保存」ボタンから保存してください。');
    } catch (error) {
      console.error("Finalize import error:", error);
    }
  }, [importConfirmData, prizes, spendingRecords]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        if (isCsv) {
          const parsed = await CsvService.parseCsv(content);
          await processImportedData(parsed, 'csv');
        } else {
          const rawJson = JSON.parse(content);
          await processImportedData(rawJson, 'json');
        }
      } catch (error) {
        alert('ファイルの読み込みに失敗しました。形式を確認してください。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [processImportedData]);

  const handleImportCode = useCallback(() => {
    setIsCodeImportOpen(true);
  }, []);

  const handleExecuteImportCode = useCallback(() => {
    const code = importTextAreaRef.current?.value;
    if (!code || !code.trim()) return;

    try {
      setSaveStatus('saving');
      setTimeout(() => {
        try {
          const rawJson = JSON.parse(code);
          processImportedData(rawJson, 'code');
          setSaveStatus('idle');
        } catch (e) {
          alert('無効なJSON形式です。');
          setSaveStatus('idle');
        }
      }, 50);
    } catch (error) {
      alert('無効なJSON形式です。');
      setSaveStatus('idle');
    }
  }, [processImportedData]);

  // Load data from IndexedDB
  useEffect(() => {
    const initData = async () => {
      try {
        const [prizeData, spendingData] = await Promise.all([
          StorageService.loadPrizes(),
          StorageService.loadSpendingRecords()
        ]);
        
        let finalPrizes = prizeData as Prize[];
        if (prizeData.length === 0) {
          const oldData = StorageService.getLocalStorageData();
          if (oldData && oldData.length > 0) {
            await StorageService.savePrizes(oldData);
            finalPrizes = oldData as Prize[];
          }
        }
        const recalced = recalcAllFromHistory(finalPrizes);
        setPrizes(recalced);
        setSpendingRecords(spendingData as SpendingRecord[]);
      } catch (error) {
        console.error("Failed to load data", error);
      }
    };
    initData();
  }, []);

  // 履歴削除などで prizes が更新されたら、開いているモーダル用の景品参照を最新化（古い履歴で上書きされるのを防ぐ）
  useEffect(() => {
    if (!isModalOpen) return;
    setPrizeToEdit(prev => {
      if (!prev) return prev;
      const latest = prizes.find(p => p.id === prev.id);
      if (!latest) return prev;
      if (historyContentKey(latest) !== historyContentKey(prev) || latest.quantity !== prev.quantity) return latest;
      return prev;
    });
  }, [prizes, isModalOpen]);

  useEffect(() => {
    setDetailPrize(prev => {
      if (!prev) return prev;
      const latest = prizes.find(p => p.id === prev.id);
      return latest ?? prev;
    });
  }, [prizes]);

  useEffect(() => {
    setHistoryPrize(prev => {
      if (!prev) return prev;
      const latest = prizes.find(p => p.id === prev.id);
      return latest ?? prev;
    });
  }, [prizes]);

  const handleSaveSpending = useCallback(async (record: SpendingRecord) => {
    setSpendingRecords(prev => [...prev, record]);
    setIsDirty(true);
  }, []);

  const handleDeleteSpending = useCallback(async (id: string) => {
    if (confirm('この記録を削除しますか？')) {
      setSpendingRecords(prev => prev.filter(r => r.id !== id));
      setIsDirty(true);
    }
  }, []);

  const handleSaveToStorage = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await Promise.all([
        StorageService.savePrizes(prizes),
        StorageService.saveSpendingRecords(spendingRecords)
      ]);
      setIsDirty(false);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error("Storage error:", error);
      const errorMessage = error instanceof Error ? error.message : "不明なエラー";
      alert(`保存に失敗しました。ストレージ容量が不足している可能性があります。\nエラー詳細: ${errorMessage}`);
      setSaveStatus('idle');
    }
  }, [prizes, spendingRecords]);

  const handleDeleteHistoryRecord = useCallback((prizeId: string, historyId: string) => {
    setPrizes(prev => {
      const next = prev.map(p => {
        if (p.id !== prizeId) return p;
        const newHistory = (p.history || []).filter(h => h.id !== historyId);
        return { ...p, history: newHistory };
      });
      setIsDirty(true);
      return recalcAllFromHistory(next);
    });
  }, []);

  const handleSavePrize = useCallback(async (prize: Prize) => {
    const timestamp = new Date().toISOString();
    const details: string[] = [];
    let updatedPrize: Prize;

    setPrizes(prevPrizes => {
      const existingIndex = prevPrizes.findIndex(p => p.id === prize.id);
      const oldPrize = existingIndex > -1 ? prevPrizes[existingIndex] : null;
      
      if (oldPrize) {
        if (oldPrize.quantity !== prize.quantity) {
          details.push(`在庫数: ${oldPrize.quantity} → ${prize.quantity}`);
        }
        
        const oldPrice = oldPrize.priceHistory && oldPrize.priceHistory.length > 0
          ? oldPrize.priceHistory[oldPrize.priceHistory.length - 1].price
          : 0;
        const newPrice = prize.priceHistory && prize.priceHistory.length > 0
          ? prize.priceHistory[prize.priceHistory.length - 1].price
          : 0;
        
        if (oldPrice !== newPrice) {
          details.push(`相場: ${oldPrice} → ${newPrice}`);
        }

        if (oldPrize.name !== prize.name) details.push(`名称変更`);
        if (oldPrize.category !== prize.category) details.push(`カテゴリ変更`);
        if (oldPrize.manufacturer !== prize.manufacturer) details.push(`メーカー変更`);
      }

      const historyEntry = oldPrize
        ? { 
            id: Math.random().toString(36).substring(2, 9),
            timestamp, 
            action: 'edit' as const, 
            details: details.length > 0 ? `編集内容: ${details.join(', ')}` : '商品情報が更新されました' 
          }
        : { 
            id: Math.random().toString(36).substring(2, 9),
            timestamp, 
            action: 'registration' as const, 
            details: `商品が新規登録されました (初期在庫: ${prize.quantity})`,
            quantity: prize.quantity
          };

      updatedPrize = {
        ...prize,
        history: [...(prize.history || []), historyEntry].slice(-100)
      };

      const nextPrizesRaw = [...prevPrizes];
      if (existingIndex > -1) {
        nextPrizesRaw[existingIndex] = updatedPrize;
      } else {
        nextPrizesRaw.push(updatedPrize);
      }
      
      setIsDirty(true);
      return recalcAllFromHistory(nextPrizesRaw);
    });
  }, []);

  const handleDeletePrize = useCallback((prizeId: string) => {
    if (confirm('この景品を削除してもよろしいですか？')) {
      setPrizes(prevPrizes => prevPrizes.filter(p => p.id !== prizeId));
      setIsDirty(true);
    }
  }, []);

  const handleQuantityChange = useCallback((prizeId: string, newQuantity: number) => {
    setPrizes(prevPrizes => {
      const nextRaw = prevPrizes.map(p => {
        if (p.id === prizeId) {
          const timestamp = new Date().toISOString();
          const historyEntry = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp,
            action: 'quantity_change' as const,
            details: `在庫数: ${p.quantity} → ${newQuantity}`,
            quantity: newQuantity
          };
          return { ...p, history: [...(p.history || []), historyEntry].slice(-100) };
        }
        return p;
      });
      setIsDirty(true);
      return recalcAllFromHistory(nextRaw);
    });
  }, []);

  const handleSale = useCallback((prizeId: string) => {
    setPrizes(prevPrizes => {
      const nextRaw = prevPrizes.map(p => {
        if (p.id === prizeId && p.quantity > 0) {
          const timestamp = new Date().toISOString();
          const latestPrice = p.priceHistory && p.priceHistory.length > 0
            ? p.priceHistory[p.priceHistory.length - 1].price
            : 0;
          const historyEntry = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp,
            action: 'sale' as const,
            details: `売却: 1個 (単価: ¥${latestPrice})`,
            price: latestPrice,
            quantity: 1,
            unitPrice: latestPrice,
            prizeId: p.id,
            type: 'sell' as const
          };
          return { ...p, history: [...(p.history || []), historyEntry].slice(-100) };
        }
        return p;
      });
      setIsDirty(true);
      return recalcAllFromHistory(nextRaw);
    });
  }, []);

  const handleAcquisition = useCallback((prizeId: string) => {
    setPrizes(prevPrizes => {
      const nextRaw = prevPrizes.map(p => {
        if (p.id === prizeId) {
          const timestamp = new Date().toISOString();
          const latestPrice = p.priceHistory && p.priceHistory.length > 0
            ? p.priceHistory[p.priceHistory.length - 1].price
            : 0;
          const historyEntry = {
            id: Math.random().toString(36).substring(2, 9),
            timestamp,
            action: 'acquisition' as const,
            details: `仕入れ: 1個 (相場: ¥${latestPrice})`,
            price: latestPrice,
            quantity: 1,
            unitPrice: latestPrice,
            prizeId: p.id,
            type: 'buy' as const
          };
          return { ...p, history: [...(p.history || []), historyEntry].slice(-100) };
        }
        return p;
      });
      setIsDirty(true);
      return recalcAllFromHistory(nextRaw);
    });
  }, []);

  const stats = useMemo(() => {
    const totalTypes = prizes.length;
    const totalQuantity = prizes.reduce((sum, p) => sum + p.quantity, 0);
    const categoryCount = prizes.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + p.quantity;
      return acc;
    }, {} as Record<string, number>);
    
    // 総資産（相場 × 数量）
    const totalValue = prizes.reduce((sum, p) => {
      const latestPrice = p.priceHistory && p.priceHistory.length > 0
        ? p.priceHistory[p.priceHistory.length - 1].price
        : 0;
      return sum + (latestPrice * p.quantity);
    }, 0);

    // 期間別の売上と仕入れ
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - (statsDays - 1));
    cutoff.setHours(0, 0, 0, 0);

    let periodSalesTotal = 0;
    let periodAcquisitionsTotal = 0;
    let periodSpendingTotal = 0;

    // グラフ用データの作成
    const dailyData: Record<string, { date: string, buyAmount: number, sellAmount: number, buyCount: number, sellCount: number, spendAmount: number }> = {};
    
    // 期間内の日付を初期化（データがない日も0で表示するため）
    for (let i = 0; i < statsDays; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      dailyData[dateStr] = { date: dateStr, buyAmount: 0, sellAmount: 0, buyCount: 0, sellCount: 0, spendAmount: 0 };
    }

    spendingRecords.forEach(r => {
      const rDate = new Date(r.date);
      if (rDate >= cutoff) {
        const year = rDate.getFullYear();
        const month = String(rDate.getMonth() + 1).padStart(2, '0');
        const day = String(rDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        if (dailyData[dateStr]) {
          dailyData[dateStr].spendAmount += r.amount;
          periodSpendingTotal += r.amount;
        }
      }
    });

    prizes.forEach(p => {
      p.history?.forEach(h => {
        const hDate = new Date(h.timestamp);
        if (hDate >= cutoff) {
          // ローカルの日付文字列をキーにする
          const year = hDate.getFullYear();
          const month = String(hDate.getMonth() + 1).padStart(2, '0');
          const day = String(hDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          if (!dailyData[dateStr]) return; // 期間外は無視

          // 'type' フィールドを優先し、互換性のために 'action' もチェック
          // 'stock' は 'buy' として扱う
          const isSale = h.type === 'sell' || h.action === 'sale';
          const isAcquisition = h.type === 'buy' || h.type === 'stock' || h.action === 'acquisition';

          const qty = h.quantity || 1;
          const up = h.unitPrice || h.price || 0;
          const amount = qty * up;

          if (isSale) {
            periodSalesTotal += amount;
            dailyData[dateStr].sellAmount += amount;
            dailyData[dateStr].sellCount += qty;
          } else if (isAcquisition) {
            periodAcquisitionsTotal += amount;
            dailyData[dateStr].buyAmount += amount;
            dailyData[dateStr].buyCount += qty;
          }
        }
      });
    });

    const chartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

    return { totalTypes, totalQuantity, categoryCount, totalValue, periodSalesTotal, periodAcquisitionsTotal, periodSpendingTotal, chartData };
  }, [prizes, spendingRecords, statsDays]);

  const allHistory = useMemo(() => {
    const histories: any[] = [];
    prizes.forEach(p => {
      p.history?.forEach(h => {
        histories.push({ 
          ...h, 
          prizeName: p.name, 
          prizeId: p.id,
          displayType: h.type === 'sell' || h.action === 'sale' ? 'sell' : (h.type === 'buy' || h.action === 'acquisition' ? 'buy' : 'other')
        });
      });
    });
    spendingRecords.forEach(s => {
      histories.push({
        id: s.id,
        timestamp: s.createdAt,
        date: s.date,
        displayType: 'spending',
        amount: s.amount,
        memo: s.memo,
        details: s.memo || '使用金額記録',
        action: 'spending',
        prizeName: '使用金額記録'
      });
    });
    const sorted = histories.sort((a, b) => new Date(b.timestamp || b.date).getTime() - new Date(a.timestamp || a.date).getTime());
    if (historyFilter === 'all') return sorted;
    return sorted.filter(h => h.displayType === historyFilter);
  }, [prizes, spendingRecords, historyFilter]);

  const filteredAndSortedPrizes = useMemo(() => {
    const filtered = prizes
      .filter(prize => {
        const nameMatch = prize.name.toLowerCase().includes(searchTerm.toLowerCase());
        const categoryMatch = selectedCategory === 'すべて' || prize.category === selectedCategory;
        const manufacturerMatch = selectedManufacturer === 'すべて' || prize.manufacturer === selectedManufacturer;
        return nameMatch && categoryMatch && manufacturerMatch;
      });

      switch (sortOrder) {
        case 'name-asc':
          return [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        case 'name-desc':
          return [...filtered].sort((a, b) => b.name.localeCompare(a.name, 'ja'));
        case 'date-desc':
        default:
          return [...filtered].sort((a, b) => new Date(b.acquisitionDate).getTime() - new Date(a.acquisitionDate).getTime());
      }
  }, [prizes, searchTerm, selectedCategory, selectedManufacturer, sortOrder]);


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans pb-32">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImportFile} 
        accept=".json,.csv" 
        className="hidden" 
      />

      <header className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100 dark:border-slate-700">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between w-full">
            <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-slate-800 dark:text-white flex items-center gap-2">
              <span className="bg-indigo-600 text-white p-1 rounded-lg sm:p-1.5 sm:rounded-xl"><ArchiveBoxIcon className="w-4 h-4 sm:w-6 sm:h-6" /></span>
              CRANE<span className="text-indigo-600">STOCK</span>
            </h1>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveToStorage}
                disabled={saveStatus === 'saving'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-[10px] sm:text-xs transition-all ${
                  isDirty 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                }`}
              >
                {saveStatus === 'saving' ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <SaveIcon className="w-3 h-3" />}
                <span>{saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '完了' : '保存'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-6">
        {activeTab === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">統計期間</p>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
                  {[1, 7, 14, 30, 90, 180, 365].map(days => (
                    <button
                      key={days}
                      onClick={() => setStatsDays(days)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black whitespace-nowrap transition-all ${
                        statsDays === days 
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {days === 1 ? '今日' : `${days}日間`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">売出総額</p>
                  <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">¥{stats.periodSalesTotal.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">使用金額</p>
                    <button 
                      onClick={() => setIsSpendingModalOpen(true)}
                      className="p-1 px-2 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-lg text-[8px] font-black hover:bg-rose-100 transition-colors"
                    >
                      管理
                    </button>
                  </div>
                  <p className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400">¥{stats.periodSpendingTotal.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">コレクション価値</p>
                  <p className="text-lg sm:text-xl font-black text-indigo-600 dark:text-indigo-400">¥{stats.totalValue.toLocaleString()}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">在庫総数</p>
                  <p className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">{stats.totalQuantity} <span className="text-[10px] font-normal text-slate-500">個</span></p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <DashboardChart 
                data={stats.chartData} 
                title="活動回数（操作数）" 
                items={[
                  { key: 'buyCount', label: '仕入れ', color: '#10b981' },
                  { key: 'sellCount', label: '売却', color: '#f43f5e' }
                ]}
                unit="回"
              />
              <DashboardChart 
                data={stats.chartData} 
                title="収支・支出推移" 
                items={[
                  { key: 'buyAmount', label: '仕入れ', color: '#10b981' },
                  { key: 'sellAmount', label: '売却', color: '#f43f5e' },
                  { key: 'spendAmount', label: '使用金額', color: '#f59e0b' }
                ]}
                unit="円"
                yAxisFormatter={(val) => `¥${val.toLocaleString()}`}
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">期間内 合計売上</p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400">¥{stats.periodSalesTotal.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">期間内 合計使用</p>
                  <button 
                    onClick={() => setIsSpendingModalOpen(true)}
                    className="p-1 px-2 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-lg text-[8px] font-black hover:bg-rose-200 transition-colors"
                  >
                    管理
                  </button>
                </div>
                <p className="text-base font-black text-rose-500">¥{stats.periodSpendingTotal.toLocaleString()}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">期間内 仕入れ価値</p>
                <p className="text-base font-black text-indigo-500">¥{stats.periodAcquisitionsTotal.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none text-white">
                <p className="text-[9px] font-black uppercase text-indigo-100 tracking-widest mb-1">期間内 利益</p>
                <p className="text-base font-black">¥{(stats.periodSalesTotal - stats.periodSpendingTotal).toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden mb-6">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">日別集計一覧</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400">
                      <th className="px-4 py-3 font-black">日付</th>
                      <th className="px-4 py-3 font-black text-right">売却</th>
                      <th className="px-4 py-3 font-black text-right">使用</th>
                      <th className="px-4 py-3 font-black text-right">仕入れ相場</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {stats.chartData.slice().reverse().map((d) => (
                      <tr key={d.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3 font-bold">{d.date.replace(/^\d{4}-/, '')}</td>
                        <td className="px-4 py-3 font-black text-right text-emerald-600 dark:text-emerald-400">¥{d.sellAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 font-black text-right text-rose-500">¥{d.spendAmount.toLocaleString()}</td>
                        <td className="px-4 py-3 font-black text-right text-indigo-500">¥{d.buyAmount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="relative flex-grow">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="景品名で検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                  <button onClick={() => setDisplayMode('card')} className={`p-1.5 rounded-xl ${displayMode === 'card' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}><Squares2x2Icon className="w-4 h-4" /></button>
                  <button onClick={() => setDisplayMode('list')} className={`p-1.5 rounded-xl ${displayMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}><QueueListIcon className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">カテゴリ絞り込み</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['すべて', ...prizeCategories].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat as any)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          selectedCategory === cat 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">メーカー絞り込み</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {['すべて', ...prizeManufacturers].map(m => (
                      <button
                        key={m}
                        onClick={() => setSelectedManufacturer(m as any)}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                          selectedManufacturer === m 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-500 border border-slate-100 dark:border-slate-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {filteredAndSortedPrizes.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700">
                <ArchiveBoxIcon className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                <h2 className="text-xl font-black">アイテムが見つかりません</h2>
                <p className="text-slate-400 text-sm mt-1">条件を変更するか、新しい景品を追加してください</p>
              </div>
            ) : displayMode === 'card' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAndSortedPrizes.map(prize => (
                  <PrizeCard
                    key={prize.id}
                    prize={prize}
                    onEdit={(p) => { setPrizeToEdit(p); setIsModalOpen(true); }}
                    onDelete={handleDeletePrize}
                    onQuantityChange={handleQuantityChange}
                    onSale={handleSale}
                    onAcquisition={handleAcquisition}
                    onShowHistory={(p) => setHistoryPrize(p)}
                    onShowDetail={(p) => setDetailPrize(p)}
                  />
                ))}
              </div>
            ) : (
              <PrizeList
                prizes={filteredAndSortedPrizes}
                onEdit={(p) => { setPrizeToEdit(p); setIsModalOpen(true); }}
                onDelete={handleDeletePrize}
                onQuantityChange={handleQuantityChange}
                onSale={handleSale}
                onAcquisition={handleAcquisition}
                onShowDetail={(p) => setDetailPrize(p)}
              />
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col items-center justify-center py-10 sm:py-20 text-center">
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-[2rem] flex items-center justify-center mb-6">
              <PlusIcon className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black mb-2">新しい景品を登録</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto mb-8 font-bold">
              景品名、カテゴリ、メーカー、画像などを登録して在庫管理を開始できます。
            </p>
            <button
              onClick={() => { setPrizeToEdit(null); setIsModalOpen(true); }}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-100 dark:shadow-none hover:scale-105 transition-all"
            >
              登録フォームを開く
            </button>
            <div className="mt-12 grid grid-cols-1 gap-4 w-full max-w-sm">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center gap-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><DocumentTextIcon className="w-5 h-5" /></div>
                  <div className="text-left">
                    <p className="text-xs font-black">レコードから一括追加</p>
                    <p className="text-[10px] text-slate-400 font-bold">CSV形式のデータを読込</p>
                  </div>
                </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black">操作履歴</h2>
                <button
                  onClick={() => setIsHistoryManagementOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  履歴削除
                </button>
              </div>
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'sell', label: '売却' },
                  { id: 'buy', label: '仕入れ' },
                  { id: 'spending', label: '使用金額' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setHistoryFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all ${
                      historyFilter === f.id 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {allHistory.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <ClockIcon className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm font-bold">履歴がありません</p>
                </div>
              ) : (
                allHistory.map((h, i) => {
                  const lineAmount = h.amount ?? (h.price != null ? h.price * (h.quantity || 1) : 0);
                  const amountPrefix =
                    h.displayType === 'sell' ? '+' : h.displayType === 'spending' ? '-' : '';
                  const amountClass =
                    h.displayType === 'sell'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : h.displayType === 'buy'
                        ? 'text-amber-600 dark:text-amber-400'
                        : h.displayType === 'spending'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-300';
                  return (
                  <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                    <div className={`mt-1 p-2 rounded-xl shrink-0 ${
                      h.displayType === 'sell' ? 'bg-emerald-50 text-emerald-500' :
                      h.displayType === 'buy' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                      h.displayType === 'spending' ? 'bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400' :
                      'bg-slate-50 text-slate-400'
                    }`}>
                      {h.displayType === 'sell' ? <CreditCardIcon className="w-4 h-4" /> :
                       h.displayType === 'buy' ? <PlusIcon className="w-4 h-4" /> :
                       h.displayType === 'spending' ? <CreditCardIcon className="w-4 h-4" /> :
                       <ArrowPathIcon className="w-4 h-4" />}
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-[10px] font-black text-slate-400">{new Date(h.timestamp || h.date).toLocaleString()}</p>
                        {lineAmount > 0 ? (
                          <p className={`text-sm font-black ${amountClass}`}>
                            {amountPrefix}¥{lineAmount.toLocaleString()}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-sm font-black text-slate-800 dark:text-white truncate">
                        {h.prizeName || (h.displayType === 'spending' ? '使用金額記録' : 'システム')}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
                        {h.details || h.memo || '詳細なし'}
                      </p>
                    </div>
                    {h.displayType === 'spending' && (
                      <button 
                        onClick={() => handleDeleteSpending(h.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all self-center"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-xl font-black">データ管理</h2>
              <p className="text-[10px] font-bold text-slate-400 mb-1">Version 4.0.2</p>
            </div>
            
            <div className="space-y-6">
              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">バックアップと復元</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button 
                    onClick={handleExportJson}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ArrowDownTrayIcon className="w-5 h-5" /></div>
                    <div className="text-left">
                      <p className="text-sm font-black">JSONバックアップ</p>
                      <p className="text-[10px] text-slate-400 font-bold">全データ（履歴込）を保存</p>
                    </div>
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl"><ArrowUpTrayIcon className="w-5 h-5" /></div>
                    <div className="text-left">
                      <p className="text-sm font-black">バックアップ読込</p>
                      <p className="text-[10px] text-slate-400 font-bold">JSONまたはCSVから復元</p>
                    </div>
                  </button>
                  <button 
                    onClick={handleImportCode}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl"><ArrowPathIcon className="w-5 h-5" /></div>
                    <div className="text-left">
                      <p className="text-sm font-black">コード読込</p>
                      <p className="text-[10px] text-slate-400 font-bold">テキストコードを貼り付けて読込</p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">外部ツール連携</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button 
                    onClick={handleExportCsv}
                    className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><DocumentTextIcon className="w-5 h-5" /></div>
                    <div className="text-left">
                      <p className="text-sm font-black">CSVエクスポート</p>
                      <p className="text-[10px] text-slate-400 font-bold">スプレッドシート閲覧用</p>
                    </div>
                  </button>
                </div>
              </section>

              <section className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest ml-1">危険な操作</p>
                <button 
                  onClick={() => {
                    if (confirm('すべての表示データをクリアしますか？（保存ボタンを押すまでは実際のデータは削除されません）')) {
                      setPrizes([]);
                      setSpendingRecords([]);
                      setIsDirty(true);
                    }
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-3xl text-red-600 hover:bg-red-100 transition-colors"
                >
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm"><TrashIcon className="w-5 h-5" /></div>
                  <div className="text-left">
                    <p className="text-sm font-black">全データ削除</p>
                    <p className="text-[10px] text-red-400 font-bold">IndexedDB内の全情報を初期化</p>
                  </div>
                </button>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-700 safe-area-bottom z-50">
        <div className="container mx-auto flex items-center justify-around h-20 px-4">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 group w-12 pt-1 transition-all ${activeTab === 'home' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'home' ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'group-hover:bg-slate-50'}`}>
              <HomeIcon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">ホーム</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('inventory')}
            className={`flex flex-col items-center gap-1 group w-12 pt-1 transition-all ${activeTab === 'inventory' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'group-hover:bg-slate-50'}`}>
              <ArchiveBoxIcon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">在庫</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex flex-col items-center gap-1 group w-12 pt-1 transition-all ${activeTab === 'add' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            <div className={`p-3 bg-indigo-600 text-white rounded-2xl -mt-8 shadow-lg shadow-indigo-200 dark:shadow-none transform transition-all group-active:scale-90 ${activeTab === 'add' ? 'scale-110' : ''}`}>
              <PlusIcon className="w-6 h-6 stroke-[3]" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">追加</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-1 group w-12 pt-1 transition-all ${activeTab === 'history' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'history' ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'group-hover:bg-slate-50'}`}>
              <ClockIcon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">履歴</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('data')}
            className={`flex flex-col items-center gap-1 group w-12 pt-1 transition-all ${activeTab === 'data' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${activeTab === 'data' ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'group-hover:bg-slate-50'}`}>
              <CogIcon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">管理</span>
          </button>
        </div>
      </nav>

      {/* History Modal */}
      {historyPrize && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">{historyPrize.name}</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">相場推移グラフ</p>
              </div>
              <button onClick={() => setHistoryPrize(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <PriceHistoryChart history={historyPrize.priceHistory || []} height={220} />
            
            <div className="mt-8 space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
               {(historyPrize.priceHistory || []).slice().reverse().map((record, i) => (
                 <div key={i} className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-slate-700/50">
                    <span className="text-xs font-bold text-slate-500">{record.date}</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">¥{record.price.toLocaleString()}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}

      <PrizeFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setPrizeToEdit(null); }}
        onSave={handleSavePrize}
        prizeToEdit={prizeToEdit}
      />

      {/* Import Confirmation Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportConfirmData(null);
        }}
        prizes={importConfirmData || []}
        onConfirm={finalizeImport}
        importType={currentImportType}
      />

      {/* Import Code Input Modal */}
      {isCodeImportOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">コードから読込</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">バックアップJSONコードを貼り付けてください</p>
              </div>
              <button 
                onClick={() => {
                  setIsCodeImportOpen(false);
                  setImportCode('');
                }} 
                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <textarea
                ref={importTextAreaRef}
                placeholder='[{"id": "...", "name": "...", ...}]'
                className="w-full h-64 p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
              <button
                onClick={handleExecuteImportCode}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 dark:shadow-none transition-all"
              >
                {saveStatus === 'saving' ? '解析中...' : 'コードを解析する'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SpendingModal
        isOpen={isSpendingModalOpen}
        onClose={() => setIsSpendingModalOpen(false)}
        spendingRecords={spendingRecords}
        onSave={handleSaveSpending}
        onDelete={handleDeleteSpending}
      />

      <HistoryManagementModal
        isOpen={isHistoryManagementOpen}
        onClose={() => setIsHistoryManagementOpen(false)}
        prizes={prizes}
        onDeleteHistory={handleDeleteHistoryRecord}
      />

      {detailPrize && (
        <PrizeDetailModal
          prize={detailPrize}
          isOpen={!!detailPrize}
          onClose={() => setDetailPrize(null)}
          onShowPriceHistory={(p) => {
            setDetailPrize(null);
            setHistoryPrize(p);
          }}
        />
      )}
    </div>
  );
};

export default App;

