"use client";

import { useState } from "react";
import GuideCertificationCheckoutButton from "@/components/GuideCertificationCheckoutButton";

export default function GuideEnrollForm() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="mt-6 rounded-lg border border-rule bg-white/[0.04] p-5 backdrop-blur-sm">
      <label className="flex items-start gap-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-1"
        />
        <span>
          I understand this is a $4,500 one-time payment for the AVAIA Certified Guide Program, and
          that enrollment begins the certification pathway, it does not itself grant certification
          or any AVAIA Guide permission. Certification is a separate, later decision based on
          demonstrated competency.
        </span>
      </label>
      <div className="mt-5">
        <GuideCertificationCheckoutButton disabled={!confirmed} />
      </div>
    </div>
  );
}
