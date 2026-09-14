import ContactForm from "@/components/ContactForm";

export const metadata = { title: "Contact, AVAIA" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-prose px-5 py-16">
      <p className="label mb-3">Get in Touch</p>
      <h1 className="font-serif text-4xl text-ink">We&rsquo;d love to hear from you.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink">
        Whether you&rsquo;re curious about the free Individual Awareness Profile, interested in
        one-on-one guiding, exploring Defying Grief, or hoping to bring an established AVAIA
        Program or Experience to a school, business, organization, or community, we&rsquo;re glad
        you&rsquo;re here.
      </p>
      <p className="mt-4 text-muted">
        Just tell us why you&rsquo;re reaching out below, a General Inquiry, bringing a Program or
        Experience to your group, One-on-One Guiding, Workshops &amp; Groups, Schools &amp;
        Organizations, Certification, or anything else on your mind, and we&rsquo;ll take it from
        there.
      </p>
      <ContactForm />
    </div>
  );
}
