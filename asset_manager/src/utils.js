// ---------- Money ----------
export function money(n) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(n) || 0);
}

// ---------- Dates ----------
// Local date -> 'YYYY-MM-DD'
export const isoDate = (date) => {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
export const today = () => isoDate(new Date());

const ET_MONTHS = ['መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን'];

// Gregorian ISO date (YYYY-MM-DD) -> Ethiopian calendar {year, month, day}
export function toEthiopian(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  // Gregorian -> Julian Day Number
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  // JDN -> Ethiopian (Amete Mihret epoch)
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

export function formatDate(iso, lang) {
  if (!iso) return '';
  if (lang === 'am') {
    const e = toEthiopian(iso);
    return `${ET_MONTHS[e.month - 1]} ${e.day}፣ ${e.year} ዓ.ም`;
  }
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ---------- Forecast ----------
// value = buy price × (1 + monthly growth % × months held). Simple and easy to explain.
const MS_PER_MONTH = 30.4375 * 24 * 3600 * 1000;

export function monthsBetween(fromIso, toDate) {
  const [y, m, d] = fromIso.split('-').map(Number);
  return Math.max(0, (toDate - new Date(y, m - 1, d)) / MS_PER_MONTH);
}

export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function forecastValue(record, types, atDate = new Date()) {
  const rate = types.find((x) => x.key === record.animal_type)?.monthly_growth || 0;
  return record.buy_price * (1 + (rate / 100) * monthsBetween(record.date, atDate));
}

// ---------- Photos: shrink before upload (phone photos are 3–8 MB) ----------
export function compressImage(file, maxSize = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// ---------- CSV export (opens in Excel, keeps Amharic text) ----------
export function downloadCsv(filename, columns, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => esc(c.label)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => esc(c.value(row))).join(','));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
