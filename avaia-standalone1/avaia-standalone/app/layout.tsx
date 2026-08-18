import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Nav from "@/components/Nav";
import SiteAnalytics from "@/components/SiteAnalytics";
import ChemistryBackground from "@/components/ChemistryBackground";
import VirtueTableBackground from "@/components/VirtueTableBackground";
import SupabaseSessionSync from "@/components/SupabaseSessionSync";

export const metadata: Metadata = {
  title: "AVAIA — Clarity Starts With Integrity",
  description:
    "AVAIA is an institution for guided conversations: understanding before action, Host ownership, continuity over time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ChemistryBackground />
        <VirtueTableBackground />
        <SiteAnalytics />
        <SupabaseSessionSync />
        <Nav />
        <main className="relative">{children}</main>
        <footer className="rule-t mt-24 border-t border-rule">
          <div className="mx-auto max-w-5xl px-5 py-10 text-sm text-muted">
            <p className="font-serif text-lg tracking-[0.16em] text-ink">AVAIA</p>
            <p className="mb-3 font-cinzel text-[0.65rem] uppercase tracking-[0.2em] text-phoenix">
              Clarity Starts With Integrity
            </p>
            <p className="max-w-prose">
              An institution for guided conversations. This platform renders the
              institutional specification; live conversation, workbook, and
              reporting are built on the same model.
            </p>
            <p className="mt-5 max-w-prose text-xs">
              AVAIA provides guided, virtue-centered conversations to support
              awareness, understanding, and intentional participation. It is not
              therapy, counseling, medical care, legal advice, or crisis
              intervention, and it does not diagnose or treat any condition. If
              you are in crisis or may be at risk of harming yourself or someone
              else, contact emergency services or, in the U.S., call or text 988.
            </p>
            <p className="mt-4 text-xs">
              © AVAIA Enterprises, LLC. The Chemistry of Virtue™ is a mark of
              AVAIA Enterprises, LLC.
            </p>
            <p className="mt-3 text-xs">
              <Link href="/privacy" className="hover:text-seal">
                Privacy Policy
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
