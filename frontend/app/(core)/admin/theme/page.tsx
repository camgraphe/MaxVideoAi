import { redirect } from 'next/navigation';

export default function RetiredThemePage() {
  redirect('/admin/settings');
}
