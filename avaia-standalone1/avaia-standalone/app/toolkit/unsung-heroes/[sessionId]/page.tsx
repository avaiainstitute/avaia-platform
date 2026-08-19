import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UnsungHeroesChat from "@/components/UnsungHeroesChat";
import { loadUnsungHeroesMessages, type UnsungHeroesConversation } from "@/lib/engine/unsung-heroes";
import { UNSUNG_HEROES_PATH_LABEL } from "@/lib/engine/prompts";
import { getGuideSession } from "@/lib/guide";

export const metadata = { title: "Unsung Heroes — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

/** Renders the same UnsungHeroesChat component the public /unsung-heroes
 *  page uses, driven by the conversation this session's start action
 *  already created (see app/toolkit/unsung-heroes/page.tsx). Unlike the
 *  Journey stages, Unsung Heroes doesn't chain into another conversation on
 *  completion -- it ends when a recognition is saved (client-side, inside
 *  UnsungHeroesChat itself) -- so there's no handoff-detection logic here. */
export default async function ToolkitUnsungHeroesSessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit");

  const session = await getGuideSession(supabase, user.id, params.sessionId);
  if (!session) notFound();
  if (session.tool !== "unsung-heroes") notFound();
  if (!session.conversation_id) notFound();

  const { data: convoData } = await supabase
    .from("unsung_heroes_conversations")
    .select("*")
    .eq("id", session.conversation_id)
    .maybeSingle();
  const convo = convoData as UnsungHeroesConversation | null;
  if (!convo) notFound();

  const rawMessages = await loadUnsungHeroesMessages(supabase, convo.id);
  const messages = rawMessages.map((m) => ({ role: m.role, content: m.content }));

  return (
    <div className="mx-auto max-w-prose">
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3 mt-8">Unsung Heroes</p>
      <h1 className="font-serif text-3xl text-ink">{UNSUNG_HEROES_PATH_LABEL[convo.path]}</h1>
      <UnsungHeroesChat
        key={convo.id}
        conversationId={convo.id}
        pathLabel={UNSUNG_HEROES_PATH_LABEL[convo.path]}
        initialMessages={messages}
      />
    </div>
  );
}
