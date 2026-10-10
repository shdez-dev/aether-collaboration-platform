import { redirect } from 'next/navigation';

// Los enlaces antiguos vuelven al inicio sin mostrar la vista retirada.
export default function TodayRedirect() {
  redirect('/dashboard');
}
