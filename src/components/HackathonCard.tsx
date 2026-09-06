import { Link } from "@tanstack/react-router";
import { CalendarDays, IndianRupee, MapPin, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtFee, isPast, daysUntil } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export function HackathonCard({ hackathon }: { hackathon: Tables<"hackathons"> }) {
  const past = isPast(hackathon.ends_at, hackathon.starts_at);
  const days = daysUntil(hackathon.starts_at);

  return (
    <Link
      to="/hackathons/$id"
      params={{ id: hackathon.id }}
      className="group flex flex-col rounded-xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg font-semibold leading-snug text-foreground group-hover:text-accent">
          {hackathon.title}
        </h3>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
      {hackathon.organizer_club && (
        <p className="mt-1 font-mono text-xs text-muted-foreground">{hackathon.organizer_club}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(hackathon.starts_at)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <IndianRupee className="h-3.5 w-3.5" /> {fmtFee(hackathon.fee)}
        </span>
        {hackathon.venue && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {hackathon.venue}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center gap-2">
        {past ? (
          <Badge variant="secondary">Ended</Badge>
        ) : days <= 7 ? (
          <Badge className="bg-accent text-accent-foreground">
            {days <= 0 ? "Happening now" : `${days}d to go`}
          </Badge>
        ) : (
          <Badge variant="secondary">Upcoming</Badge>
        )}
        {(hackathon.tags ?? []).slice(0, 3).map((t) => (
          <Badge key={t} variant="outline" className="font-mono text-[10px]">
            {t}
          </Badge>
        ))}
      </div>
    </Link>
  );
}
