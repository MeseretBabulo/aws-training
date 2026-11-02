import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './api.js';
import { makeT } from './i18n.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import Assets from './components/Assets.jsx';
import { RecordForm, AssetForm } from './components/Forms.jsx';

const LANG_KEY = 'am_lang';
const readLang = () => {
  try { return localStorage.getItem(LANG_KEY) || 'am'; } catch { return 'am'; }
};

export default function App() {
  const [lang, setLang] = useState(readLang);
  const [authed, setAuthed] = useState(() => !!api.getPin());
  const [tab, setTab] = useState('home');
  const [records, setRecords] = useState([]);
  const [assets, setAssets] = useState([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null); // { kind: 'record'|'asset', item }
  const [toast, setToast] = useState('');
  const [installEvent, setInstallEvent] = useState(null);

  const t = useMemo(() => makeT(lang), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  // "Add to home screen" support (Chrome / Android)
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const handleError = useCallback(
    (e) => {
      if (e instanceof api.AuthError) setAuthed(false);
      else flash(t('error'));
    },
    [t],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, a] = await Promise.all([api.list('records'), api.list('assets')]);
      setRecords(r.rows);
      setAssets(a.rows);
      setOffline(r.offline || a.offline);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function save(kind, data) {
    const resource = kind === 'record' ? 'records' : 'assets';
    try {
      if (data.id) await api.update(resource, data.id, data);
      else await api.create(resource, data);
      setForm(null);
      flash(t('saved'));
      load();
    } catch (e) {
      handleError(e);
    }
  }

  async function del(kind, item) {
    if (!window.confirm(t('confirmDelete'))) return;
    try {
      await api.remove(kind === 'record' ? 'records' : 'assets', item.id);
      setForm(null);
      flash(t('deleted'));
      load();
    } catch (e) {
      handleError(e);
    }
  }

  const toggleLang = () => setLang((l) => (l === 'am' ? 'en' : 'am'));

  if (!authed) {
    return <Login t={t} onLogin={() => setAuthed(true)} onToggleLang={toggleLang} />;
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/icons/icon-192.png" alt="" width="32" height="32" />
          <span>{t('appName')}</span>
        </div>
        <div className="topbar-actions">
          {installEvent && (
            <button
              className="chip chip-accent"
              onClick={async () => {
                installEvent.prompt();
                await installEvent.userChoice;
                setInstallEvent(null);
              }}
            >
              ⬇ {t('install')}
            </button>
          )}
          {!installEvent && isIos && (
            <button className="chip" onClick={() => alert(t('iosInstall'))}>
              ⬇
            </button>
          )}
          <button className="chip" onClick={toggleLang}>
            {t('language')}
          </button>
          <button
            className="chip"
            aria-label={t('logout')}
            title={t('logout')}
            onClick={() => {
              api.logout();
              setAuthed(false);
            }}
          >
            🚪
          </button>
        </div>
      </header>

      {offline && <div className="banner">{t('offline')}</div>}

      <main className="content">
        {tab === 'home' ? (
          <Dashboard
            t={t}
            lang={lang}
            records={records}
            assets={assets}
            loading={loading}
            onOpen={(item) => setForm({ kind: 'record', item })}
          />
        ) : (
          <Assets t={t} lang={lang} assets={assets} loading={loading} onOpen={(item) => setForm({ kind: 'asset', item })} />
        )}
      </main>

      <button
        className="fab"
        aria-label={tab === 'home' ? t('newRecord') : t('newAsset')}
        onClick={() => setForm({ kind: tab === 'home' ? 'record' : 'asset', item: null })}
        disabled={offline}
      >
        +
      </button>

      <nav className="bottomnav">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
          <span className="nav-icon">🐄</span>
          {t('home')}
        </button>
        <button className={tab === 'assets' ? 'active' : ''} onClick={() => setTab('assets')}>
          <span className="nav-icon">🏠</span>
          {t('assets')}
        </button>
      </nav>

      {form?.kind === 'record' && (
        <RecordForm
          t={t}
          lang={lang}
          item={form.item}
          locations={[...new Set(records.map((r) => r.location))]}
          receivers={[...new Set(records.map((r) => r.receiver))]}
          onSave={(d) => save('record', d)}
          onDelete={(i) => del('record', i)}
          onClose={() => setForm(null)}
        />
      )}
      {form?.kind === 'asset' && (
        <AssetForm
          t={t}
          item={form.item}
          locations={[...new Set([...assets.map((a) => a.location), ...records.map((r) => r.location)])]}
          onSave={(d) => save('asset', d)}
          onDelete={(i) => del('asset', i)}
          onClose={() => setForm(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
