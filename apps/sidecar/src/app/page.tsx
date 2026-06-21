/**
 * Sidecar root — redirects to /studio.
 */
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/studio');
}
