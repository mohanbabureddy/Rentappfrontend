import React from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage } from './i18n';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select
      aria-label="Language"
      value={i18n.language}
      onChange={(e) => setLanguage(e.target.value)}
      style={{
        marginLeft: 12,
        padding: '4px 8px',
        borderRadius: 6,
        border: '1px solid #cbd5e1',
        fontSize: 13,
        background: '#fff',
        color: '#0f172a',
        cursor: 'pointer',
      }}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
