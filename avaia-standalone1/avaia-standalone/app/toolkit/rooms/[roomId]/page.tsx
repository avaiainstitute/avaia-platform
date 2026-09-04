import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listGuideParticipants } from "@/lib/guide";
import {
  getRoom,
  listRoomParticipants,
  loadRoomMessages,
  getRoomReferral,
} from "@/lib/engine/room";
import RoomView from "@/components/RoomView";

export const metadata = { title: "Shared Room — Guide Toolkit — AVAIA" };
export const dynamic = "force-dynamic";

export default async function RoomDetailPage({ params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?from=/toolkit/rooms");

  const room = await getRoom(supabase, params.roomId);
  if (!room || room.guide_id !== user.id) notFound();

  const [participants, messages, roster, referral] = await Promise.all([
    listRoomParticipants(supabase, room.id),
    loadRoomMessages(supabase, room.id),
    listGuideParticipants(supabase, user.id),
    room.status === "complete" ? getRoomReferral(supabase, room.id) : Promise.resolve(null),
  ]);

  return (
    <div>
      <p className="mb-6">
        <Link href="/toolkit/rooms" className="label hover:text-seal">
          ← All Rooms
        </Link>
      </p>
      <p className="label mb-3">Shared Room</p>
      <h1 className="font-serif text-3xl text-ink">{room.title ?? "This Room hasn't found its name yet."}</h1>

      <div className="mt-8">
        <RoomView
          room={{ id: room.id, title: room.title, status: room.status, program: room.program }}
          initialParticipants={participants}
          initialMessages={messages}
          roster={roster.map((r) => ({ id: r.id, name: r.name }))}
          initialReferral={referral as any}
        />
      </div>
    </div>
  );
}
