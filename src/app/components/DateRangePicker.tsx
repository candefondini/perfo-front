//src/app/components/DateRangePicker

'use client';

import { useState, useEffect } from 'react';

export default function DateRangePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [date, setDate] = useState(value);

  useEffect(() => {
    setDate(value);
  }, [value]);

  return (
    <input
      type="date"
      value={date}
      onChange={(e) => {
        const newVal = e.target.value;
        setDate(newVal);
        onChange(newVal);
      }}
      style={{
        background: '#0b1220',
        border: '1px solid #1f2937',
        borderRadius: 8,
        color: '#e5e7eb',
        padding: '6px 10px',
        fontSize: 14,
        boxShadow:
          'inset 3px 3px 6px rgba(0,0,0,.5), inset -3px -3px 6px rgba(255,255,255,.05)',
      }}
    />
  );
}
