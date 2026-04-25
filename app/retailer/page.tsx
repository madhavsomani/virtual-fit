// Phase 7.61: this page used to be a no-auth demo of the embed snippet —
// it hardcoded VirtualFit purple, had no shopId, and no PDP knobs, so it
// silently defeated Phases 7.56/7.57/7.58. The real flow lives at
// `/retailer/signup`. Permanently redirect.
import { redirect } from "next/navigation";

export default function RetailerPage() {
  redirect("/retailer/signup");
}
