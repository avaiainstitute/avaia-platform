import { redirect } from "next/navigation";

// Consolidated into /contact (the site's single Contact doorway now
// covers general inquiries, bringing a Program/Experience, guiding,
// workshops, schools, certification, and anything else). This route is
// kept as a redirect, not deleted, since it was Dorian's own shareable
// "Bring AVAIA to your school, business, or community" URL on social
// media -- an existing link out in the world should still work.
export default function ExperiencesRedirectPage() {
  redirect("/contact?reason=bring_a_program");
}
