import { ASSET_ICON } from '../i18n.js';
import { formatDate, money } from '../utils.js';

export default function Assets({ t, lang, assets, loading, onOpen }) {
  const total = assets.reduce((s, a) => s + a.value, 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('propertyList')}</h2>
        <span className="muted small">
          {money(total)} {t('birr')}
        </span>
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
                <span>{a.date ? formatDate(a.date, lang) : ''}</span>
                <span>
                  {money(a.value)}
                  {a.forecast_value > 0 && <> → <b>{money(a.forecast_value)}</b></>} {t('birr')}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
