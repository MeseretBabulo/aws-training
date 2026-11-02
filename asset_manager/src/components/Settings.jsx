import { useState } from 'react';
import { CATEGORIES, CATEGORY_ICON } from '../i18n.js';

// One editable row. Shows "Save" only when something changed.
function EditRow({ t, item, fields, onSave, onDelete }) {
  const [draft, setDraft] = useState(item);
  const dirty = fields.some((f) => String(draft[f.key] ?? '') !== String(item[f.key] ?? ''));

  return (
    <form
      className="edit-row"
      onSubmit={async (e) => {
        e.preventDefault();
        if (dirty) await onSave(draft);
      }}
    >
      {fields.map((f) => (
        <label key={f.key} className={`edit-cell ${f.className || ''}`}>
          <span>{f.label}</span>
          <input
            type={f.type || 'text'}
            inputMode={f.type === 'number' ? 'decimal' : undefined}
            step={f.type === 'number' ? '0.1' : undefined}
            min={f.type === 'number' ? '0' : undefined}
            value={draft[f.key] ?? ''}
            onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
          />
        </label>
      ))}
      <div className="edit-actions">
        {dirty && <button className="btn btn-primary btn-sm">✓</button>}
        {item.id && (
          <button type="button" className="btn btn-danger btn-sm" aria-label={t('delete')} onClick={() => onDelete(item)}>
            🗑
          </button>
        )}
      </div>
    </form>
  );
}

// Empty row for adding; resets after a successful save.
function AddRow({ t, label, fields, base, onSave }) {
  const [key, setKey] = useState(0);
  return (
    <div className="add-row">
      <span className="add-label">＋ {label}</span>
      <EditRow
        key={key}
        t={t}
        item={base}
        fields={fields}
        onSave={async (d) => {
          if (await onSave(d)) setKey((k) => k + 1);
        }}
        onDelete={() => {}}
      />
    </div>
  );
}

export default function Settings({ t, owners, types, onSave, onDelete, onLogout }) {
  const [category, setCategory] = useState('cattle');
  const ownerFields = [{ key: 'name', label: t('name'), className: 'grow' }];
  const typeFields = [
    { key: 'name_am', label: t('nameAm'), className: 'grow' },
    { key: 'name_en', label: t('nameEn'), className: 'grow' },
    { key: 'monthly_growth', label: t('monthlyGrowth'), type: 'number', className: 'narrow' },
  ];
  const catTypes = types.filter((x) => x.category === category);

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>👤 {t('owners')}</h2>
        </div>
        <p className="muted small help">{t('ownersHelp')}</p>
        {owners.map((o) => (
          <EditRow
            key={`${o.id}-${o.name}`}
            t={t}
            item={o}
            fields={ownerFields}
            onSave={(d) => onSave('owners', d)}
            onDelete={(i) => onDelete('owners', i)}
          />
        ))}
        <AddRow
          t={t}
          label={t('addOwner')}
          fields={ownerFields}
          base={{ name: '', sort_order: owners.length }}
          onSave={(d) => onSave('owners', d)}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>🐄 {t('animalTypes')}</h2>
        </div>
        <p className="muted small help">{t('typesHelp')}</p>
        <div className="filters">
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${category === c ? 'chip-on' : ''}`} onClick={() => setCategory(c)}>
              {CATEGORY_ICON[c]} {t(c)}
            </button>
          ))}
        </div>
        {catTypes.map((x) => (
          <EditRow
            key={`${x.id}-${x.name_am}-${x.name_en}-${x.monthly_growth}`}
            t={t}
            item={x}
            fields={typeFields}
            onSave={(d) => onSave('animal-types', d)}
            onDelete={(i) => onDelete('animal-types', i)}
          />
        ))}
        <AddRow
          key={category}
          t={t}
          label={t('addType')}
          fields={typeFields}
          base={{ category, name_am: '', name_en: '', monthly_growth: 1, sort_order: catTypes.length + 100 }}
          onSave={(d) => onSave('animal-types', d)}
        />
      </section>

      <section className="panel">
        <button className="btn btn-full" onClick={onLogout}>
          🚪 {t('logout')}
        </button>
      </section>
    </>
  );
}
