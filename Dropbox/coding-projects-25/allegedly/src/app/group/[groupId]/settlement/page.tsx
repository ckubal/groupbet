'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GroupSettlementPage() {
  const router = useRouter();

  useEffect(() => {
    // For now, just use the regular settlement page
    // In the future, this could be group-specific
    router.push('/settlement');
  }, [router]);

  return null;
}