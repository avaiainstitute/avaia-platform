import ContactForm from "@/components/ContactForm";

export const metadata = { title: "Contact — AVAIA" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">Get in Touch</p>
      <h1 className="font-serif text-4xl text-ink">We&rsquo;d love to hear from you.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        Whether you&rsquo;re curious about the free Individual Awareness Profile, interested in
        one-on-one guiding, exploring Defying Grief, or reaching out on behalf of a school or
        organization, we&rsquo;re glad you&rsquo;re here.
      </p>
      <p className="mt-4 text-muted">
        You can reach out about a General Inquiry, One-on-One Guiding, Workshops &amp; Groups,
        Schools &amp; Organizations, Certification, or anything else on your mind — just let us
        know below.
      </p>
      <ContactForm />
    </div>
  );
}
