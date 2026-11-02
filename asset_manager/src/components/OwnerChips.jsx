// Owner filter shown on top of Livestock and Property pages.
export default function OwnerChips({ t, owners, value, onChange }) {
  if (owners.length < 2) return null;
  return (
    <div className="owner-bar">
      {[{ id: 'all', name: t('allOwners') }, ...owners].map((o) => (
        <button key={o.id} className={`chip ${value === o.id ? 'chip-on' : ''}`} onClick={() => onChange(o.id)}>
          {o.id === 'all' ? '👨‍👩‍👦 ' : '👤 '}
          {o.name}
        </button>
      ))}
    </div>
  );
}
