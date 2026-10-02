import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "AVAIA Admin" };
export const dynamic = "force-dynamic";

/** Gates the entire /admin tree. No /admin area existed anywhere in the
 *  codebase before this build (confirmed by audit) -- this is the first
 *  one, kept intentionally minimal: a title bar and sign-out, mirroring
 *  app/toolkit/layout.tsx's own shape. Not linked from the global Nav,
 *  reachable only by URL, same posture as the Toolkit layout before it. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/admin");

  const admin = await isAdmin(supabase, user.id);
  if (!admin) redirect("/");

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <div className="flex items-baseline justify-between">
        <Link href="/admin" className="flex items-baseline gap-2.5">
          <span className="font-serif text-xl tracking-[0.16em] text-ink">AVAIA</span>
          <span className="label text-muted">Admin</span>
        </Link>
        <SignOutButton />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
