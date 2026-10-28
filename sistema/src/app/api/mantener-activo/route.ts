import { connection } from "next/server";
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

// Supabase (plan gratis) pausa el proyecto tras unos 7 días sin uso y el sistema deja de andar.
// Vercel llama a esta dirección una vez por día (ver vercel.json) para que siempre haya actividad.
// Solo hace una consulta con la clave pública: no lee ni cambia datos (RLS no devuelve nada sin sesión).
export async function GET() {
  await connection();
  if (!isSupabaseConfigured) return Response.json({ ok: true, modo: "demo" });
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?select=id&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: "no-store",
    });
    return Response.json({ ok: res.ok, estado: res.status }, { status: res.ok ? 200 : 502 });
  } catch {
    return Response.json({ ok: false, estado: "sin respuesta" }, { status: 502 });
  }
}
