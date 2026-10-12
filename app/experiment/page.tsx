import { redirect } from 'next/navigation';

export default function LegacyExperimentPage() {
  redirect('/preview');
}
