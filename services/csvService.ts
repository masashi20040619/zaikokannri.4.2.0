
import Papa from 'papaparse';
import { Prize, PrizeCategory, Manufacturer } from '../types';

const CATEGORIES: PrizeCategory[] = ['マスコット', 'ぬいぐるみ', 'フィギュア', 'その他'];
const MANUFACTURERS: Manufacturer[] = ['バンダイナムコ', 'タイトー', 'SEGA FAVE', 'FuRyu', 'Parade', 'SK', 'その他'];

export const CsvService = {
  exportToCsv: (prizes: Prize[]) => {
    const data = prizes.map(p => ({
      '景品名': p.name,
      'カテゴリ': p.category,
      'メーカー': p.manufacturer || 'その他',
      '在庫数': p.quantity,
      '獲得日': p.acquisitionDate,
      '現在の相場': p.priceHistory && p.priceHistory.length > 0 ? p.priceHistory[p.priceHistory.length - 1].price : 0,
      '備考': p.notes || ''
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `crane_stock_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  },

  parseCsv: (csvString: string): Promise<Prize[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(csvString, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const prizes: Prize[] = results.data.map((row: any) => {
            const name = row['景品名'] || '名称未設定';
            const category = CATEGORIES.includes(row['カテゴリ']) ? row['カテゴリ'] : 'その他';
            const manufacturer = MANUFACTURERS.includes(row['メーカー']) ? row['メーカー'] : 'その他';
            const quantity = parseInt(row['在庫数']) || 0;
            const acquisitionDate = row['獲得日'] || new Date().toISOString().split('T')[0];
            const price = parseInt(row['現在の相場']) || 0;
            const notes = row['備考'] || '';

            return {
              id: Math.random().toString(36).substr(2, 9),
              name,
              category,
              manufacturer,
              quantity,
              acquisitionDate,
              notes,
              priceHistory: price > 0 ? [{ date: new Date().toISOString(), price }] : [],
              history: [{
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toISOString(),
                action: 'import',
                details: 'CSVからインポートされました'
              }]
            };
          });
          resolve(prizes);
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }
};
