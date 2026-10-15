import { redirect } from "next/navigation";

/** Serve the approved reservation demo from its dedicated HTML page. */
export default function ReservationPage() {
  redirect("/asztalfoglalas.html");
}
