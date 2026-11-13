// Manda un mail a Aramé cada vez que entra un pedido nuevo desde la tienda.
// La llama la base de datos (trigger en public.pedidos) con {"id": "<uuid del pedido>"}.
// No necesita clave: solo avisa pedidos que existen y que todavía no se avisaron.
import { createClient } from "jsr:@supabase/supabase-js@2";

const AVISO_A = Deno.env.get("AVISO_EMAIL") ?? "aramecocina@gmail.com";
const DESDE = Deno.env.get("AVISO_DESDE") ?? "Aramé pedidos <onboarding@resend.dev>";

const money = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

type Item = { id: string; nombre: string; q: number; precio: number | null };

function armarMail(p: Record<string, any>) {
  const items: Item[] = Array.isArray(p.items) ? p.items : [];
  const filas = items.map((it) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #eee">${esc(it.q)} × ${esc(it.nombre)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${it.precio ? money(it.precio * it.q) : "a consultar"}</td>
    </tr>`).join("");
  const entrega = p.modo === "envio" ? `Envío a: ${esc(p.direccion)}` : "Retiro en el local";
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111">
    <div style="background:#000;color:#FE6002;padding:16px 20px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold">Nuevo pedido #${esc(p.codigo)}</div>
    <div style="border:1px solid #eee;border-top:0;padding:18px 20px;border-radius:0 0 12px 12px">
      <p style="margin:0 0 6px"><b>Cliente:</b> ${esc(p.cliente || "Sin nombre")}</p>
      <p style="margin:0 0 6px"><b>Entrega:</b> ${entrega}</p>
      ${p.para ? `<p style="margin:0 0 6px"><b>Para:</b> ${esc(p.para)}</p>` : ""}
      ${p.notas ? `<p style="margin:0 0 6px"><b>Aclaraciones:</b> ${esc(p.notas)}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:15px">${filas}</table>
      ${Number(p.descuento) > 0 ? `<p style="margin:0;text-align:right;color:#c00">Promo: −${money(p.descuento)}</p>` : ""}
      <p style="margin:6px 0 0;text-align:right;font-size:18px"><b>Total: ${money(p.total)}</b></p>
      <p style="margin:18px 0 0;color:#666;font-size:13px">El cliente también mandó el pedido por WhatsApp con el código #${esc(p.codigo)}. Para aprobarlo o rechazarlo, entrá al panel → Pedidos.</p>
    </div>
  </div>`;
  const texto = [
    `Nuevo pedido #${p.codigo}`,
    `Cliente: ${p.cliente || "Sin nombre"}`,
    p.modo === "envio" ? `Envío a: ${p.direccion}` : "Retiro en el local",
    ...(p.para ? [`Para: ${p.para}`] : []),
    ...(p.notas ? [`Aclaraciones: ${p.notas}`] : []),
    "",
    ...items.map((it) => `• ${it.q} × ${it.nombre}` + (it.precio ? ` (${money(it.precio * it.q)})` : " (a consultar)")),
    "",
    `Total: ${money(p.total)}`,
  ].join("\n");
  const asunto = `Nuevo pedido #${p.codigo} · ${p.cliente || "Sin nombre"} · ${money(p.total)}`;
  return { html, texto, asunto };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Solo POST", { status: 405 });
  const { id } = await req.json().catch(() => ({ id: null }));
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Falta el id", { status: 400 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // se marca como avisado antes de mandar: así nunca sale el mismo aviso dos veces
  const { data: pedido, error } = await db.from("pedidos").update({ avisado: true })
    .eq("id", id).eq("avisado", false).select("*").maybeSingle();
  if (error) return new Response("Error de base: " + error.message, { status: 500 });
  if (!pedido) return new Response("Ya avisado o no existe", { status: 200 });

  const clave = Deno.env.get("RESEND_API_KEY");
  const { html, texto, asunto } = armarMail(pedido);
  let ok = false, detalle = "";
  if (clave) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: DESDE, to: [AVISO_A], subject: asunto, html, text: texto }),
    });
    ok = r.ok; detalle = ok ? "" : await r.text();
  } else detalle = "Falta la clave RESEND_API_KEY";

  if (!ok) {
    // si no salió el mail, queda para reintentar
    await db.from("pedidos").update({ avisado: false }).eq("id", id);
    return new Response("No se pudo mandar el mail: " + detalle, { status: 502 });
  }
  return new Response("Aviso enviado", { status: 200 });
});
