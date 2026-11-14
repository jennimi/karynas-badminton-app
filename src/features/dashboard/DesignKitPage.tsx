import { Check, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../shared/ui/badge';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { IconPicker } from '../../shared/components/brand/IconPicker';
import { Input } from '../../shared/ui/input';

const swatches = [
  { name: 'Lavender', cls: 'bg-brand', soft: 'bg-brand-soft text-brand-strong' },
  { name: 'Lime', cls: 'bg-lime', soft: 'bg-lime-soft text-lime-strong' },
  { name: 'Butter', cls: 'bg-butter', soft: 'bg-butter-soft text-butter-strong' },
  { name: 'Coral', cls: 'bg-coral', soft: 'bg-coral-soft text-coral-strong' },
];

/** Every shared component in one place. Add new shared components here too. */
export default function DesignKitPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Design kit</h1>
        <p className="mt-1 text-muted-foreground">
          The shared building blocks. Reuse these — don’t restyle your own.
        </p>
      </header>

      <IconPicker />

      <Card>
        <CardHeader><CardTitle>Colours</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {swatches.map((s) => (
            <div key={s.name} className="space-y-2">
              <div className={`flex h-16 items-end rounded-2xl p-3 text-sm font-extrabold text-ink ${s.cls}`}>
                {s.name}
              </div>
              <div className={`rounded-xl px-3 py-2 text-sm font-bold ${s.soft}`}>
                Soft + readable text
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Buttons</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button><Plus /> Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="lime"><Check /> Approve</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger"><Trash2 /> Delete</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Add"><Plus /></Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Badges</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge>Neutral</Badge>
            <Badge variant="brand">Not paid</Badge>
            <Badge variant="butter">Waiting approval</Badge>
            <Badge variant="lime">Approved</Badge>
            <Badge variant="coral">Cancelled</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Inputs & toasts</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Member name" aria-label="Member name" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => toast.success('Session created! 🎉')}>
                Success toast
              </Button>
              <Button size="sm" variant="secondary" onClick={() => toast.error('Something went wrong')}>
                Error toast
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
