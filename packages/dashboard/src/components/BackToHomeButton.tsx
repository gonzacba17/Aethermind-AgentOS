import { Home } from 'lucide-react';
import { Button } from './ui/button';

const LANDING_PAGE_URL = 'https://aethermind-page.vercel.app/';

export function BackToHomeButton() {
  return (
    <a href={LANDING_PAGE_URL} rel="noopener noreferrer">
      <Button variant="outline">
        <Home className="h-4 w-4 mr-2" />
        Back to Home
      </Button>
    </a>
  );
}
