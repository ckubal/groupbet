'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GroupConsensusPage() {
  const router = useRouter();

  useEffect(() => {
    // For now, just use the regular consensus page
    // In the future, this could be group-specific
    router.push('/consensus');
  }, [router]);

  return null;
}