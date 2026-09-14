import ExperienceInquiryForm from "@/components/ExperienceInquiryForm";

export const metadata = { title: "Bring an AVAIA Experience, AVAIA" };

// Agent 8 (Programs & Experiences) inbound public intake page -- the
// shareable URL Dorian can use ("Bring AVAIA to your school, business, or
// community") on social media. Linked in the main site nav as "Bring a
// Program" (components/Nav.tsx) so it's reachable without already knowing
// this exact URL. Same pattern as app/contact/page.tsx: a server component
// wrapping a client form.
export default function ExperiencesPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">Bring AVAIA to Your Group</p>
      <h1 className="font-serif text-4xl text-ink">
        Bring an established AVAIA Experience to your school, business, or community.
      </h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        Defying Grief, Youth Defying Grief, Workshops &amp; Speaking, Chemistry of Virtue,
        Unsung Heroes, and The View From Above can each be brought to a group, in a format
        that fits your setting.
      </p>
      <p className="mt-4 text-muted">
        Tell us a little about your group and what you&rsquo;re interested in, and Dorian will
        follow up personally to talk through what would fit.
      </p>
      <ExperienceInquiryForm />
    </div>
  );
}
