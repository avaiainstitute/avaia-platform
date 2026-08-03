import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import LibraryEntryForm from "@/components/LibraryEntryForm";

export const metadata = { title: "New Library Entry — AVAIA" };
export const dynamic = "force-dynamic";

export default async function NewLibraryEntryPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await isAdmin(supabase, user.id))) redirect("/library");

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <Link href="/admin/library" className="label hover:text-seal">
        ← Library Admin
      </Link>
      <h1 className="mt-6 font-serif text-4xl text-ink">New entry</h1>
      <LibraryEntryForm />
    </div>
  );
}
