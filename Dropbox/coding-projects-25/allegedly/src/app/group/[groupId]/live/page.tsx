'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GroupLivePage() {
  const router = useRouter();

  useEffect(() => {
    // For now, just use the regular live page
    // In the future, this could be group-specific
    router.push('/live');
  }, [router]);

  return null;
}