import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MonthlyPlan {
  id: string;
  name: string;
  price: string;
  description: string;
  highlights: string[];
}

const monthlyPlans: MonthlyPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "€99/mo",
    description: "Perfect for indie creators exploring branded content.",
    highlights: [
      "Includes 120 credits / month",
      "Email support",
      "Monthly performance report",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: "€249/mo",
    description: "Agile teams shipping weekly campaigns across platforms.",
    highlights: [
      "Includes 350 credits / month",
      "Priority render queue",
      "Shared asset library",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: "€599/mo",
    description: "Full-service agencies managing multi-brand workloads.",
    highlights: [
      "Includes 900 credits / month",
      "Dedicated success manager",
      "Custom SLA & white-label portal",
    ],
  },
];

export function MonthlyPlansShowcase() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {monthlyPlans.map((plan) => (
        <Card key={plan.id} className="border-border/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{plan.name}</CardTitle>
              {plan.id === "studio" ? <Badge variant="secondary">Popular</Badge> : null}
            </div>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-semibold text-foreground">{plan.price}</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {plan.highlights.map((highlight) => (
                <li key={highlight}>• {highlight}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
