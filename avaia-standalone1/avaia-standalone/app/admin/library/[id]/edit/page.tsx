import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import LibraryEntryForm from "@/components/LibraryEntryForm";
import type { LibraryEntry } from "@/lib/library";

export const metadata = { title: "Edit Library Entry — AVAIA" };
export const dynamic = "force-dynamic";

export default async function EditLibraryEntryPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await isAdmin(supabase, user.id))) redirect("/library");

  const { data } = await supabase
    .from("library_entries")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <Link href="/admin/library" className="label hover:text-seal">
        ← Library Admin
      </Link>
      <h1 className="mt-6 font-serif text-4xl text-ink">Edit entry</h1>
      <LibraryEntryForm initial={data as LibraryEntry} />
    </div>
  );
}
