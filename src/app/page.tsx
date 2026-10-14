import { redirect } from "next/navigation";

/** The approved V2 homepage is served as a static HTML document. */
export default function Home() {
  redirect("/kastelydomb-v2.html");
}
