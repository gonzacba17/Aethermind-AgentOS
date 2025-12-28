'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

export function BackToHomeButton() {
  return (
    <Link href="/">
      <Button variant="outline" size="sm" className="gap-2">
        <Home className="h-4 w-4" />
        Back to Home
      </Button>
    </Link>
  );
}
