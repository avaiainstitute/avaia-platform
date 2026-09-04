import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listRooms, createRoom } from "@/lib/engine/room";
import type { DbRoom } from "@/lib/engine/room";

export const metadata = { title: "Shared Rooms — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

async function startRoom(formData: FormData) {
  "use server";

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit/rooms");

  const programRaw = String(formData.get("program") ?? "general");
  const program = (["general", "defying-grief", "youth"] as const).includes(programRaw as any)
    ? (programRaw as "general" | "defying-grief" | "youth")
    : "general";

  const room = await createRoom(supabase, user.id, program);
  redirect(`/toolkit/rooms/${room.id}`);
}

function statusLabel(room: DbRoom) {
  return room.status === "complete" ? "Closed" : "Active";
}

export default async function RoomsListPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit/rooms");

  const rooms = await listRooms(supabase, user.id);

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit" className="label hover:text-seal">
          ← Back to Dashboard
        </Link>
      </p>
      <p className="label mb-3">Shared Rooms</p>
      <h1 className="font-serif text-4xl text-ink">More than one person, one Table.</h1>
      <p className="mt-4 text-lg text-muted">
        A Room is not the people in it — it is what the shared conversation becomes. Every
        participant keeps ownership of their own story; nothing moves from private into shared
        without their own choice.
      </p>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Open a New Room</p>
        <form
          action={startRoom}
          className="rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm"
        >
          <label className="label mb-2 block" htmlFor="program">
            Program
          </label>
          <select
            id="program"
            name="program"
            defaultValue="general"
            className="w-full max-w-xs rounded-md border border-rule bg-white/[0.04] px-4 py-3 text-ink outline-none backdrop-blur-sm focus:border-seal"
          >
            <option value="general">General</option>
            <option value="defying-grief">Defying Grief</option>
            <option value="youth">Youth</option>
          </select>
          <p className="mt-2 text-sm text-muted">
            You will invite participants to the Table on the next screen.
          </p>
          <button
            type="submit"
            className="mt-4 inline-block rounded-md bg-seal px-5 py-2.5 font-sans text-sm font-semibold text-[#05060b] transition-opacity hover:opacity-90"
          >
            Open Room
          </button>
        </form>
      </section>

      <section className="rule-t mt-14 border-t border-rule pt-8">
        <p className="label mb-3 text-muted">Your Rooms</p>
        {rooms.length === 0 ? (
          <p className="text-muted">No Rooms yet.</p>
        ) : (
          <div className="space-y-3">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/toolkit/rooms/${room.id}`}
                className="block rounded-lg border border-rule bg-white/[0.04] px-5 py-4 backdrop-blur-sm transition-colors hover:border-seal"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-serif text-lg text-ink">{room.title ?? "Untitled Room"}</p>
                  <span className="label shrink-0 text-muted">{statusLabel(room)}</span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {room.program} · opened {new Date(room.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
