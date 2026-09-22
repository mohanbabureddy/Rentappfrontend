import React from 'react';
import { useTranslation } from 'react-i18next';
import TenantVacate from './TenantVacate';

export default function TenantVacatePage() {
  const { t } = useTranslation();
  return (
    <div className="bills-page">
      <h2 style={{ color: '#2563eb', textAlign: 'center', marginBottom: 20, letterSpacing: '1px', fontWeight: 'bold' }}>
        {t('vacate.heading')}
      </h2>
      <TenantVacate />
    </div>
  );
}
