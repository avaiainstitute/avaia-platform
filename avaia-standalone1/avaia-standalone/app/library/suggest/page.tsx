import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LibrarySuggestionForm from "@/components/LibrarySuggestionForm";

export const metadata = { title: "Suggest a Resource — AVAIA" };
export const dynamic = "force-dynamic";

export default async function LibrarySuggestPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <Link href="/library" className="label hover:text-seal">
        ← Library
      </Link>
      <h1 className="mt-6 font-serif text-4xl text-ink">Suggest a resource</h1>
      <p className="mt-4 text-lg text-muted">
        Know something — a book, article, talk, or tool — that belongs in the Library? Suggest it
        here. Every suggestion is reviewed by an AVAIA admin before anything is published; nothing
        goes live automatically.
      </p>
      <LibrarySuggestionForm />
    </div>
  );
}
