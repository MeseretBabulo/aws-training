import { useMemo } from 'react';
import { ASSET_ICON, ASSET_TYPES, ownerName } from '../i18n.js';
import { downloadCsv, formatDate, money } from '../utils.js';
import OwnerChips from './OwnerChips.jsx';

export default function Assets({ t, lang, owners, ownerFilter, setOwnerFilter, assets, loading, onOpen }) {
  const total = assets.reduce((s, a) => s + a.value, 0);
  const byType = useMemo(
    () =>
      ASSET_TYPES.map((type) => {
        const rows = assets.filter((a) => a.asset_type === type);
        return { type, count: rows.length, value: rows.reduce((s, a) => s + a.value, 0) };
      }).filter((x) => x.count > 0),
    [assets],
  );

  const exportCsv = () =>
    downloadCsv('property.csv', [
      { label: t('name'), value: (a) => a.name },
      { label: t('assetType'), value: (a) => t(`at_${a.asset_type}`) },
      { label: t('owner'), value: (a) => ownerName(owners, a.owner_id) },
      { label: t('location'), value: (a) => a.location },
      { label: t('date'), value: (a) => a.date },
      { label: t('value'), value: (a) => a.value },
      { label: t('notes'), value: (a) => a.notes },
    ], assets);

  return (
    <>
      <OwnerChips t={t} owners={owners} value={ownerFilter} onChange={setOwnerFilter} />

      <section className="kpis kpis-2">
        <div className="kpi">
          <span className="kpi-icon">🏠</span>
          <span className="kpi-value">{assets.length}</span>
          <span className="kpi-label">{t('propertyCount')}</span>
        </div>
        <div className="kpi kpi-money kpi-left">
          <span className="kpi-label">{t('totalValue')}</span>
          <span className="kpi-value">
            {money(total)} <small>{t('birr')}</small>
          </span>
        </div>
        {byType.length > 0 && (
          <div className="type-strip">
            {byType.map((x) => (
              <span key={x.type} className="type-pill">
                {ASSET_ICON[x.type]} {t(`at_${x.type}`)} <b>{x.count}</b> · {money(x.value)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{t('propertyList')}</h2>
          <button className="chip" onClick={exportCsv} disabled={!assets.length}>
            ⇩ {t('export')}
          </button>
        </div>

        {!loading && assets.length === 0 && <p className="empty">{t('noAssets')}</p>}

        <ul className="cards cards-always">
          {assets.map((a) => (
            <li key={a.id} className="card" onClick={() => onOpen(a)}>
              {a.photo ? <img className="thumb" src={a.photo} alt="" loading="lazy" /> : <span className="thumb thumb-icon">{ASSET_ICON[a.asset_type]}</span>}
              <div className="card-body">
                <div className="card-row">
                  <strong>{a.name}</strong>
                  <span className="status">{t(`at_${a.asset_type}`)}</span>
                </div>
                <div className="muted">📍 {a.location}</div>
                <div className="card-row muted small">
                  <span>
                    👤 {ownerName(owners, a.owner_id)}
                    {a.date ? ` · ${formatDate(a.date, lang)}` : ''}
                  </span>
                  <span>
                    <b>{money(a.value)}</b> {t('birr')}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
