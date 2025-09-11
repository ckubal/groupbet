import { UserProvider } from '@/lib/user-context';
import { redirect } from 'next/navigation';

const VALID_GROUP_ID = 'allegedly-nfl-2024';

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  // Await params in Next.js 15
  const { groupId } = await params;
  
  // Verify this is a valid group
  if (groupId !== VALID_GROUP_ID) {
    redirect('/');
  }

  return <UserProvider>{children}</UserProvider>;
}