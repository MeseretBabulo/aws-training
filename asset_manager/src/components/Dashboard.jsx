import { useMemo, useState } from 'react';
import { CATEGORIES, CATEGORY_ICON, OWNED_STATUSES, animalTypeLabel } from '../i18n.js';
import { downloadCsv, formatDate, money } from '../utils.js';

export default function Dashboard({ t, lang, records, assets, loading, onOpen }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const kpi = useMemo(() => {
    const owned = records.filter((r) => OWNED_STATUSES.includes(r.status));
    const count = (c) => owned.filter((r) => r.category === c).reduce((s, r) => s + r.quantity, 0);
    const livestockCost = owned.reduce((s, r) => s + r.buy_price, 0);
    const livestockForecast = owned.reduce((s, r) => s + r.forecast_price, 0);
    const propertyCost = assets.reduce((s, a) => s + a.value, 0);
    const propertyForecast = assets.reduce((s, a) => s + a.forecast_value, 0);
    return {
      cattle: count('cattle'),
      sheep: count('sheep'),
      goat: count('goat'),
      other: count('other'),
      livestockCost,
      propertyCost,
      cost: livestockCost + propertyCost,
      livestockForecast,
      propertyForecast,
      forecast: livestockForecast + propertyForecast,
    };
  }, [records, assets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter(
      (r) =>
        (category === 'all' || r.category === category) &&
        (!q || [r.receiver, r.location, r.phone, r.notes].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [records, query, category]);

  const exportCsv = () =>
    downloadCsv('livestock-records.csv', [
      { label: t('date'), value: (r) => r.date },
      { label: t('receiverShort'), value: (r) => r.receiver },
      { label: t('phone'), value: (r) => r.phone },
      { label: t('location'), value: (r) => r.location },
      { label: t('category'), value: (r) => t(r.category) },
      { label: t('animalType'), value: (r) => animalTypeLabel(r.category, r.animal_type, lang) },
      { label: t('quantity'), value: (r) => r.quantity },
      { label: t('buyPrice'), value: (r) => r.buy_price },
      { label: t('forecastPrice'), value: (r) => r.forecast_price },
      { label: t('status'), value: (r) => t(`st_${r.status}`) },
      { label: t('notes'), value: (r) => r.notes },
    ], filtered);

  const gain = kpi.forecast - kpi.cost;

  return (
    <>
      <section className="kpis">
        {['cattle', 'sheep', 'goat'].map((c) => (
          <div key={c} className={`kpi kpi-${c}`}>
            <span className="kpi-icon">{CATEGORY_ICON[c]}</span>
            <span className="kpi-value">{kpi[c]}</span>
            <span className="kpi-label">{t(c)}</span>
          </div>
        ))}
        <div className="kpi kpi-wide kpi-money">
          <span className="kpi-label">{t('totalCost')}</span>
          <span className="kpi-value">
            {money(kpi.cost)} <small>{t('birr')}</small>
          </span>
          <span className="kpi-sub">
            {t('livestock')} {money(kpi.livestockCost)} · {t('property')} {money(kpi.propertyCost)}
          </span>
        </div>
        <div className="kpi kpi-wide kpi-forecast">
          <span className="kpi-label">{t('forecast')}</span>
          <span className="kpi-value">
            {money(kpi.forecast)} <small>{t('birr')}</small>
          </span>
          <span className={`kpi-sub ${gain >= 0 ? 'pos' : 'neg'}`}>
            {t('profit')}: {gain >= 0 ? '+' : '−'}
            {money(Math.abs(gain))} {t('birr')}
          </span>
        </div>
        {kpi.other > 0 && (
          <div className="kpi-note">
            {CATEGORY_ICON.other} {t('other')}: {kpi.other}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('records')}</h2>
          <button className="chip" onClick={exportCsv} disabled={!filtered.length}>
            ⇩ {t('export')}
          </button>
        </div>

        <input className="search" type="search" placeholder={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} />

        <div className="filters">
          {['all', ...CATEGORIES].map((c) => (
            <button key={c} className={`chip ${category === c ? 'chip-on' : ''}`} onClick={() => setCategory(c)}>
              {c === 'all' ? t('all') : `${CATEGORY_ICON[c]} ${t(c)}`}
            </button>
          ))}
        </div>

        {!loading && filtered.length === 0 && <p className="empty">{t('noRecords')}</p>}

        {/* Mobile: cards */}
        <ul className="cards">
          {filtered.map((r) => (
            <li key={r.id} className="card" onClick={() => onOpen(r)}>
              {r.photo ? <img className="thumb" src={r.photo} alt="" loading="lazy" /> : <span className="thumb thumb-icon">{CATEGORY_ICON[r.category]}</span>}
              <div className="card-body">
                <div className="card-row">
                  <strong>{r.receiver}</strong>
                  <span className={`status st-${r.status}`}>{t(`st_${r.status}`)}</span>
                </div>
                <div className="muted">
                  {r.quantity} × {animalTypeLabel(r.category, r.animal_type, lang) || t(r.category)} · 📍 {r.location}
                </div>
                <div className="card-row muted small">
                  <span>{formatDate(r.date, lang)}</span>
                  <span>
                    {money(r.buy_price)} → <b>{money(r.forecast_price)}</b> {t('birr')}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Tablet / desktop: table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('receiverShort')}</th>
                <th>{t('location')}</th>
                <th>{t('animalType')}</th>
                <th className="num">{t('quantity')}</th>
                <th className="num">{t('buyPrice')}</th>
                <th className="num">{t('forecastPrice')}</th>
                <th>{t('status')}</th>
                <th>{t('photo')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} onClick={() => onOpen(r)}>
                  <td>{formatDate(r.date, lang)}</td>
                  <td>
                    {r.receiver}
                    {r.phone && <div className="muted small">{r.phone}</div>}
                  </td>
                  <td>{r.location}</td>
                  <td>
                    {CATEGORY_ICON[r.category]} {animalTypeLabel(r.category, r.animal_type, lang) || t(r.category)}
                  </td>
                  <td className="num">{r.quantity}</td>
                  <td className="num">{money(r.buy_price)}</td>
                  <td className="num">{money(r.forecast_price)}</td>
                  <td>
                    <span className={`status st-${r.status}`}>{t(`st_${r.status}`)}</span>
                  </td>
                  <td>{r.photo && <img className="thumb thumb-sm" src={r.photo} alt="" loading="lazy" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
