import { redirect } from "next/navigation";

// Data SEN se fusionó con la portada — este alias evita enlaces rotos.
export default function SenRedirect() {
  redirect("/");
}
