import Link from "next/link";

// AVAIA Chemistry of Virtue connection fix (1/5): a recognized virtue
// anywhere in the app should be a real link to its canonical Chemistry
// entry, not plain text. A plain <Link> with query params (not a client
// component with sessionStorage + navigation) so this works from any
// Server Component -- Workbook, the Unsung Heroes dashboard, Preparation
// -- with no client-side wiring needed at the call site. /chemistry's own
// mount effect (app/chemistry/page.tsx) resolves these params via the
// exact same resolveFocus() the live <<focus: Family | Virtue>> marker
// mechanism already uses (lib/virtue-focus.ts), so a family NAME
// ("Positive Attitude", as referrals store it) or a family KEY ("positive-
// attitude", as Unsung Heroes' recognitions.virtue_family stores it) both
// resolve correctly -- callers never need to normalize which shape they
// have.
export function virtueChemistryHref(family: string, virtue?: string | null): string {
  const params = new URLSearchParams({ family });
  if (virtue) params.set("virtue", virtue);
  return `/chemistry?${params.toString()}`;
}

export function VirtueLink({
  family,
  virtue,
  className,
  style,
  children,
}: {
  family: string;
  virtue?: string | null;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Link href={virtueChemistryHref(family, virtue)} className={className} style={style}>
      {children}
    </Link>
  );
}
