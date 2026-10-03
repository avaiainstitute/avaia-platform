"use client";

import { useEffect } from "react";
import { recordOpenedAction } from "@/app/certification/actions";

/** Quietly records that the candidate opened this lesson or Practice Lab, so
 *  the classroom can bring them back to it. Renders nothing; a failure is
 *  ignored because it must never get in the way of reading. */
export default function CertificationOpenBeacon({ itemKey }: { itemKey: string }) {
  useEffect(() => {
    recordOpenedAction(itemKey).catch(() => {});
  }, [itemKey]);
  return null;
}
