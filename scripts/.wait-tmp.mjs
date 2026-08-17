import { config } from "dotenv";
import { SignJWT } from "jose";
config({ path: ".env.local" });
const token = await new SignJWT({ username: "admin", role: "admin" })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2h")
  .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
for (let i = 1; i <= 40; i++) {
  const r = await fetch("https://transitionlatam.com/admin/editar-data", { headers: { cookie: `session=${token}` } });
  const txt = (await r.text()).replace(/<[^>]+>/g," ").replace(/\s+/g," ");
  const total = (txt.match(/([\d.]+) proyectos —/) ?? ["?"])[0];
  const pelp = txt.includes("Expansión Futura");
  if (!total.startsWith("0 ") ) { console.log(`deploy listo tras ~${i*15}s -> ${total} | link PELP: ${pelp ? "SI" : "no"}`); break; }
  if (i === 40) console.log(`sigue en "${total}" tras 10 min | link PELP: ${pelp ? "SI" : "no"}`);
  await new Promise(r => setTimeout(r, 15000));
}
