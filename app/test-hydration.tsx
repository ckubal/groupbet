'use client';

import React, { useState, useEffect } from 'react';

export default function TestHydration() {
  const [isClient, setIsClient] = useState(false);
  
  // Use useEffect to detect client-side hydration
  useEffect(() => {
    setIsClient(true);
    console.log('🎯 TEST COMPONENT HYDRATED SUCCESSFULLY!');
  }, []);
  
  console.log('🧪 TEST COMPONENT RENDERING - Client side:', typeof window !== 'undefined', 'isClient state:', isClient);
  
  return (
    <div>
      <h1>Hydration Test</h1>
      <p>Server/Client: {typeof window !== 'undefined' ? 'CLIENT' : 'SERVER'}</p>
      <p>Hydrated: {isClient ? 'YES' : 'NO'}</p>
    </div>
  );
}