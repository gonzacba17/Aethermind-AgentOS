'use client';

import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';

const LANDING_PAGE_URL = 'https://aethermind-page.vercel.app/';

export function BackToHomeButton() {
  return (
    <a href={LANDING_PAGE_URL} rel="noopener noreferrer">
      <Button variant="outline" size="sm" className="gap-2">
        <Home className="h-4 w-4" />
        Volver a Home
      </Button>
    </a>
  );
}
