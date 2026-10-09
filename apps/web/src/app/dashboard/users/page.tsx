import { redirect } from 'next/navigation';

// Legacy URL: contacts now owns the people directory.
export default function UsersPage() {
  redirect('/dashboard/contacts');
}
