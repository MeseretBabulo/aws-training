import { useEffect, useRef, useState } from 'react';
import { ASSET_ICON, ASSET_TYPES, CATEGORIES, CATEGORY_ICON, STATUSES, typeName } from '../i18n.js';
import { addMonths, compressImage, forecastValue, formatDate, money, today } from '../utils.js';

// ---------- Shared pieces ----------
function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <b className="req"> *</b>}
      </span>
      {children}
    </label>
  );
}

function PhotoInput({ t, value, onChange }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      onChange(await compressImage(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      <span>{t('photo')}</span>
      {value && <img className="photo-preview" src={value} alt="" />}
      <div className="photo-actions">
        <button type="button" className="btn" onClick={() => cameraRef.current.click()} disabled={busy}>
          📷 {t('takePhoto')}
        </button>
        <button type="button" className="btn" onClick={() => galleryRef.current.click()} disabled={busy}>
          🖼️ {t('choosePhoto')}
        </button>
        {value && (
          <button type="button" className="btn btn-ghost" onClick={() => onChange(null)}>
            {t('removePhoto')}
          </button>
        )}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

function Actions({ t, isEdit, onDelete, onClose }) {
  return (
    <div className="form-actions">
      {isEdit && (
        <button type="button" className="btn btn-danger" onClick={onDelete}>
          🗑 {t('delete')}
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="btn" onClick={onClose}>
        {t('cancel')}
      </button>
      <button type="submit" className="btn btn-primary">
        ✓ {t('save')}
      </button>
    </div>
  );
}

const useForm = (initial) => {
  const [data, setData] = useState(initial);
  const set = (key) => (e) => setData((d) => ({ ...d, [key]: e?.target ? e.target.value : e }));
  return [data, set, setData];
};

// ---------- Livestock record ----------
function OwnerPicker({ t, owners, value, onChange }) {
  return (
    <div className="field">
      <span>{t('owner')}</span>
      <div className="owner-pick">
        {owners.map((o) => (
          <button type="button" key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)}>
            👤 {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------- Livestock record ----------
export function RecordForm({ t, lang, item, owners, types, defaultOwner, locations, receivers, onSave, onDelete, onClose }) {
  const typesOf = (c) => types.filter((x) => x.category === c);
  const [data, set, setData] = useForm(
    item ?? {
      date: today(),
      owner_id: defaultOwner,
      receiver: '',
      phone: '',
      location: '',
      category: 'cattle',
      animal_type: typesOf('cattle').find((x) => x.key === 'cow')?.key || typesOf('cattle')[0]?.key || '',
      quantity: 1,
      buy_price: '',
      status: 'held',
      photo: null,
      notes: '',
    },
  );
  const [showErrors, setShowErrors] = useState(false);
  const options = typesOf(data.category);
  const selectedType = types.find((x) => x.key === data.animal_type);

  const chooseCategory = (c) => setData((d) => ({ ...d, category: c, animal_type: typesOf(c)[0]?.key || '' }));
  const stepQty = (delta) => setData((d) => ({ ...d, quantity: Math.max(1, (Number(d.quantity) || 1) + delta) }));

  // Live forecast preview
  const preview = { ...data, buy_price: Number(data.buy_price) || 0 };
  const now = new Date();
  const valueNow = data.date ? forecastValue(preview, types, now) : 0;
  const valueIn12 = data.date ? forecastValue(preview, types, addMonths(now, 12)) : 0;
  const qty = Number(data.quantity) || 1;

  function submit(e) {
    e.preventDefault();
    if (!data.date || !data.receiver.trim() || !data.location.trim() || !data.animal_type || !data.owner_id) {
      setShowErrors(true);
      return;
    }
    onSave(data);
  }

  return (
    <Sheet title={item ? t('editRecord') : t('newRecord')} onClose={onClose}>
      <form onSubmit={submit} noValidate className={showErrors ? 'show-errors' : ''}>
        <OwnerPicker t={t} owners={owners} value={data.owner_id} onChange={set('owner_id')} />

        <div className="field">
          <span>{t('category')}</span>
          <div className="segmented">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} className={data.category === c ? 'on' : ''} onClick={() => chooseCategory(c)}>
                <span className="seg-icon">{CATEGORY_ICON[c]}</span>
                {t(c)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <Field label={t('animalType')}>
            <select value={data.animal_type} onChange={set('animal_type')}>
              {options.map((x) => (
                <option key={x.key} value={x.key}>
                  {lang === 'en' || !x.name_en ? typeName(x, lang) : `${x.name_am} (${x.name_en})`}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('quantity')}>
            <div className="stepper">
              <button type="button" onClick={() => stepQty(-1)} aria-label="-1">
                −
              </button>
              <input type="number" inputMode="numeric" min="1" value={data.quantity} onChange={set('quantity')} />
              <button type="button" onClick={() => stepQty(1)} aria-label="+1">
                +
              </button>
            </div>
          </Field>
        </div>

        <Field label={t('date')} required>
          <input type="date" value={data.date} onChange={set('date')} required />
          {lang === 'am' && data.date && <span className="hint">{formatDate(data.date, 'am')}</span>}
        </Field>

        <Field label={`${t('buyPriceOnly')} (${t('birr')})`}>
          <input type="number" inputMode="decimal" min="0" value={data.buy_price} onChange={set('buy_price')} />
          {preview.buy_price > 0 && (
            <div className="forecast-box">
              {qty > 1 && (
                <div>
                  {t('perHead')}: {money(preview.buy_price / qty)} {t('birr')}
                </div>
              )}
              <div>
                📈 {t('growthInfo').replace('{r}', selectedType?.monthly_growth ?? 0)}
              </div>
              <div className="forecast-row">
                <span>
                  {t('estNow')}: <b>{money(valueNow)}</b>
                </span>
                <span>
                  {t('estIn12')}: <b>{money(valueIn12)}</b> {t('birr')}
                </span>
              </div>
            </div>
          )}
        </Field>

        <Field label={t('receiver')} required>
          <input value={data.receiver} onChange={set('receiver')} list="receivers" required autoComplete="off" />
          <datalist id="receivers">
            {receivers.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </Field>

        <Field label={t('phone')}>
          <input type="tel" inputMode="tel" value={data.phone || ''} onChange={set('phone')} placeholder="09…" />
        </Field>

        <Field label={t('location')} required>
          <input value={data.location} onChange={set('location')} list="locations" placeholder={t('locationHint')} required autoComplete="off" />
          <datalist id="locations">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>

        <Field label={t('status')}>
          <select value={data.status} onChange={set('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`st_${s}`)}
              </option>
            ))}
          </select>
        </Field>

        <PhotoInput t={t} value={data.photo} onChange={set('photo')} />

        <Field label={t('notes')}>
          <textarea rows="2" value={data.notes || ''} onChange={set('notes')} />
        </Field>

        {showErrors && <p className="error">{t('required')}</p>}
        <Actions t={t} isEdit={!!item} onDelete={() => onDelete(item)} onClose={onClose} />
      </form>
    </Sheet>
  );
}

// ---------- Property / other asset ----------
export function AssetForm({ t, item, owners, defaultOwner, locations, onSave, onDelete, onClose }) {
  const [data, set] = useForm(
    item ?? { name: '', asset_type: 'land', owner_id: defaultOwner, location: '', date: today(), value: '', photo: null, notes: '' },
  );
  const [showErrors, setShowErrors] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!data.name.trim() || !data.location.trim() || !data.owner_id) {
      setShowErrors(true);
      return;
    }
    onSave(data);
  }

  return (
    <Sheet title={item ? t('editAsset') : t('newAsset')} onClose={onClose}>
      <form onSubmit={submit} noValidate className={showErrors ? 'show-errors' : ''}>
        <OwnerPicker t={t} owners={owners} value={data.owner_id} onChange={set('owner_id')} />

        <div className="field">
          <span>{t('assetType')}</span>
          <div className="segmented segmented-3">
            {ASSET_TYPES.map((a) => (
              <button type="button" key={a} className={data.asset_type === a ? 'on' : ''} onClick={() => set('asset_type')(a)}>
                <span className="seg-icon">{ASSET_ICON[a]}</span>
                {t(`at_${a}`)}
              </button>
            ))}
          </div>
        </div>

        <Field label={t('name')} required>
          <input value={data.name} onChange={set('name')} required />
        </Field>

        <Field label={t('location')} required>
          <input value={data.location} onChange={set('location')} list="asset-locations" placeholder={t('locationHint')} required autoComplete="off" />
          <datalist id="asset-locations">
            {locations.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>

        <div className="grid-2">
          <Field label={t('date')}>
            <input type="date" value={data.date || ''} onChange={set('date')} />
          </Field>
          <Field label={`${t('value')} (${t('birr')})`}>
            <input type="number" inputMode="decimal" min="0" value={data.value} onChange={set('value')} />
          </Field>
        </div>

        <PhotoInput t={t} value={data.photo} onChange={set('photo')} />

        <Field label={t('notes')}>
          <textarea rows="2" value={data.notes || ''} onChange={set('notes')} />
        </Field>

        {showErrors && <p className="error">{t('required')}</p>}
        <Actions t={t} isEdit={!!item} onDelete={() => onDelete(item)} onClose={onClose} />
      </form>
    </Sheet>
  );
}
