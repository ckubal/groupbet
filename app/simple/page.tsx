'use client';

import React, { useState, useEffect } from 'react';

export default function SimplePage() {
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    console.log('🎉 SIMPLE PAGE HYDRATED!');
    setHydrated(true);
  }, []);
  
  console.log('🧪 SIMPLE PAGE RENDERING - Client:', typeof window !== 'undefined', 'Hydrated:', hydrated);
  
  return (
    <div>
      <h1>Simple Test</h1>
      <p>Client side: {typeof window !== 'undefined' ? 'YES' : 'NO'}</p>
      <p>Hydrated: {hydrated ? 'YES' : 'NO'}</p>
    </div>
  );
}