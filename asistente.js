/* Asistente de consultas de Aramé.
 *
 * Responde preguntas simples (horarios, dirección, productos, precios, stock, promos,
 * cómo pedir, envíos y pagos) leyendo catalogo.json, el mismo archivo que edita el panel.
 * Funciona en el navegador, sin servidor y sin servicios pagos.
 * Si no entiende una pregunta, ofrece mandarla por WhatsApp.
 */
(function () {
  "use strict";

  // ---------- texto ----------
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ\s]/g, " ").replace(/\s+/g, " ").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString("es-AR");

  const VACIAS = new Set("a al algo alguna algun alguno como con cual cuales cuando cuanto cuantos cuesta cuestan de del el en es esta estan hay la las lo los me mi para por que quiero se si sus te tenes tienen tiene un una uno unos y o precio precios sale salen vale valen venden vendes ver dame decime saber hola buenas buen dia tardes noches gracias hacen x u gr g kg ml".split(" "));

  // Otras formas de escribir los productos y rubros.
  const SINONIMOS = {
    baklava: "backlava", baclava: "backlava", baklawa: "backlava",
    humus: "hummus", hommus: "hummus",
    babaganush: "babaganoush", babaganuch: "babaganoush", babaganoush: "babaganoush",
    tabule: "tabule", taboule: "tabule", tabbouleh: "tabule",
    lahmacun: "lehmeyun", lajmayun: "lehmeyun", lehmejun: "lehmeyun", lehmeyun: "lehmeyun", lahmajun: "lehmeyun", lehmayun: "lehmeyun",
    fatai: "fatay", fatayer: "fatay",
    borek: "boreg", boreks: "boreg", boregs: "boreg",
    narguile: "shisha", narguiles: "shisha", hookah: "shisha", shishas: "shisha", cachimba: "shisha",
    postre: "dulces", postres: "dulces", dulce: "dulces",
    entrada: "entradas", picada: "entradas", picadas: "entradas", medze: "entradas", meze: "entradas",
    ensalada: "ensaladas",
    acompanamiento: "acompanamientos", guarnicion: "acompanamientos", guarniciones: "acompanamientos",
    plato: "platos", principal: "principales",
    aceite: "aceites", oliva: "aceites",
    almacen: "almacen",
    tahini: "tahin",
    couscous: "cous",
    pretzel: "pretzels",
    parra: "parra",
  };
  const raiz = (w) => SINONIMOS[w] || w;
  const palabras = (s) => norm(s).split(" ").filter((w) => w && !VACIAS.has(w) && !/^\d+$/.test(w)).map(raiz);

  function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // Coincide igual, en plural/singular, por comienzo o con una letra de diferencia.
  function parecidas(a, b) {
    if (a === b) return true;
    if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
    return a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1;
  }
  const tiene = (texto, lista) => lista.some((k) => (" " + texto + " ").includes(" " + k + " "));

  // ---------- datos ----------
  let DATA = null;
  async function cargar() {
    const r = await fetch("catalogo.json?v=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error(r.status);
    DATA = await r.json();
    DATA.productos = DATA.productos || [];
    DATA.negocio = DATA.negocio || {};
  }
  const N = () => DATA.negocio;
  const nombreLocal = () => N().nombre || "Aramé";
  const linkWA = (texto) => `https://wa.me/${String(N().whatsapp || "").replace(/\D/g, "")}${texto ? "?text=" + encodeURIComponent(texto) : ""}`;
  const stockDe = (p) => (typeof p.stock === "number" && isFinite(p.stock) ? Math.max(0, Math.floor(p.stock)) : null);
  const sinStock = (p) => p.disponible === false || stockDe(p) === 0;
  const tienePrecio = (p) => typeof p.precio === "number" && p.precio > 0;
  const descuento = (p) => (tienePrecio(p) ? Math.max(0, Math.min(90, Math.round(Number(p.descuento) || 0))) : 0);
  const precioFinal = (p) => (descuento(p) ? Math.round(p.precio * (1 - descuento(p) / 100)) : p.precio);
  const UNIDAD = { unidad: "", docena: " la docena", porcion: " la porción", kg: " el kg", pote: " el pote", bandeja: " la bandeja" };

  // ---------- horario ----------
  const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  // Interpreta textos como "Lunes a sábado · 11 a 15 h y 17 a 20 h". Si no puede, devuelve null.
  function leerHorario(texto) {
    const t = norm(texto);
    const dias = new Set();
    const rango = t.match(/(domingo|lunes|martes|miercoles|jueves|viernes|sabado)s? a (domingo|lunes|martes|miercoles|jueves|viernes|sabado)s?/);
    if (rango) {
      for (let i = DIAS.indexOf(rango[1]), n = 0; n < 7; i = (i + 1) % 7, n++) {
        dias.add(i);
        if (i === DIAS.indexOf(rango[2])) break;
      }
    } else DIAS.forEach((d, i) => t.includes(d) && dias.add(i));
    const tramos = [];
    for (const m of t.matchAll(/(\d{1,2})(?: (\d{2}))? (?:a|hasta) (\d{1,2})(?: (\d{2}))?/g)) {
      const desde = +m[1] * 60 + (+m[2] || 0), hasta = +m[3] * 60 + (+m[4] || 0);
      if (desde < hasta && hasta <= 24 * 60) tramos.push([desde, hasta]);
    }
    return dias.size && tramos.length ? { dias, tramos } : null;
  }
  function estadoAhora() {
    const h = leerHorario(N().horario);
    if (!h) return null;
    const partes = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()).map((p) => [p.type, p.value]));
    const dia = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(partes.weekday);
    const min = +partes.hour * 60 + +partes.minute;
    const hhmm = (m) => `${Math.floor(m / 60)}${m % 60 ? ":" + String(m % 60).padStart(2, "0") : ""} h`;
    if (h.dias.has(dia)) {
      const abierto = h.tramos.find(([a, b]) => min >= a && min < b);
      if (abierto) return `Ahora estamos <b>abiertos</b>, hasta las ${hhmm(abierto[1])}.`;
      const prox = h.tramos.find(([a]) => a > min);
      if (prox) return `Ahora estamos cerrados. Hoy volvemos a abrir a las ${hhmm(prox[0])}.`;
    }
    for (let i = 1; i <= 7; i++) {
      const d = (dia + i) % 7;
      if (h.dias.has(d)) return `Ahora estamos cerrados. Abrimos ${i === 1 ? "mañana" : "el " + DIAS[d].replace("miercoles", "miércoles").replace("sabado", "sábado")} a las ${hhmm(h.tramos[0][0])}.`;
    }
    return null;
  }

  // ---------- respuestas ----------
  function tarjetaProducto(p) {
    const precio = tienePrecio(p)
      ? `${money(precioFinal(p))}${UNIDAD[p.unidad] || ""}${descuento(p) ? ` <s>${money(p.precio)}</s> <span class="tag promo">${descuento(p)}% OFF</span>` : ""}`
      : "Precio a consultar";
    const st = stockDe(p);
    const estado = sinStock(p)
      ? `<span class="tag no">Sin stock por ahora</span>`
      : st !== null && st <= 5 ? `<span class="tag poco">${st === 1 ? "Queda 1" : `Quedan ${st}`}</span>` : "";
    return `<div class="prod">
      <div class="pn"><b>${esc(p.nombre)}</b>${p.peso ? ` <span class="peso">· ${esc(p.peso)}</span>` : ""}</div>
      ${p.descripcion ? `<div class="pd">${esc(p.descripcion)}</div>` : ""}
      <div class="pp">${precio} ${estado}</div>
      ${!sinStock(p) ? `<button class="ver" data-ver="${esc(p.id)}">Ver en la tienda</button>` : ""}
    </div>`;
  }

  function buscarProductos(consulta) {
    const qs = palabras(consulta).filter((w) => !CLAVES.has(w));
    if (!qs.length) return [];
    const puntajes = DATA.productos.map((p) => {
      const nombre = palabras(p.nombre), cat = palabras(p.categoria + " " + (p.seccion || "")), desc = palabras(p.descripcion);
      let pts = 0;
      for (const q of qs) {
        if (nombre.some((w) => parecidas(q, w))) pts += 3;
        else if (cat.some((w) => parecidas(q, w))) pts += 2;
        else if (desc.some((w) => parecidas(q, w))) pts += 1;
      }
      return { p, pts };
    });
    const max = Math.max(0, ...puntajes.map((x) => x.pts));
    const lista = max ? puntajes.filter((x) => x.pts === max).map((x) => x.p) : [];
    lista.porNombre = max >= 3;
    return lista;
  }

  function categoriaPedida(consulta) {
    const qs = palabras(consulta);
    return (DATA.categorias || []).find((c) => {
      const cw = palabras(c);
      return qs.some((q) => cw.some((w) => parecidas(q, w)));
    });
  }

  const R = {
    horario(t = "") {
      const base = `Nuestro horario es: <b>${esc(N().horario || "a confirmar")}</b>.`;
      if (/feriado/.test(t)) return `${base}<br>Para feriados, fijate si hay un aviso arriba en la tienda o <a href="${linkWA("Hola, ¿abren el feriado?")}" target="_blank" rel="noopener">consultanos por WhatsApp</a>.`;
      const h = leerHorario(N().horario);
      const dia = DIAS.findIndex((d) => new RegExp("\\b" + d + "s?\\b").test(t));
      if (h && dia >= 0) {
        const nombre = ["domingos", "lunes", "martes", "miércoles", "jueves", "viernes", "sábados"][dia];
        return h.dias.has(dia) ? `Sí, los ${nombre} abrimos. ${base}` : `Los ${nombre} no abrimos. ${base}`;
      }
      const ahora = estadoAhora();
      return base + (ahora ? "<br>" + ahora : "");
    },
    direccion() {
      const dir = N().direccion;
      if (!dir) return "Escribinos por WhatsApp y te pasamos la dirección.";
      return `Estamos en <b>${esc(dir)}</b>. <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nombreLocal() + ", " + dir)}" target="_blank" rel="noopener">Ver en el mapa</a>`;
    },
    pedir() {
      return `Es muy simple:<ol><li>Elegí los productos en esta página y tocá <b>Agregar</b>.</li><li>Tocá <b>Ver pedido</b>, completá tu nombre y si querés retiro o envío.</li><li>Se abre WhatsApp con el pedido armado: solo tenés que enviarlo.</li></ol>Nosotros te respondemos para confirmar.`;
    },
    envio() {
      return N().envios
        ? esc(N().envios)
        : "Podés <b>retirar en el local</b> o pedir <b>envío</b> (lo elegís al armar el pedido). El costo y el horario del envío te los confirmamos por WhatsApp según la zona.";
    },
    pago() {
      return N().pagos ? esc(N().pagos) : "El pago se coordina por WhatsApp cuando confirmamos tu pedido.";
    },
    promos() {
      const lineas = [];
      const pr = DATA.promos && DATA.promos.total;
      if (pr && pr.activa && Number(pr.porcentaje) > 0) lineas.push(`<b>${esc(pr.texto || `${pr.porcentaje}% OFF en el total de tu compra${pr.minimo ? " desde " + money(pr.minimo) : ""}`)}</b>`);
      const con = DATA.productos.filter((p) => descuento(p) && !sinStock(p));
      if (!lineas.length && !con.length) return "En este momento no tenemos promociones. Te recomendamos seguirnos en Instagram para enterarte de las próximas.";
      return (lineas.length ? lineas.join("<br>") + (con.length ? "<br><br>" : "") : "") + (con.length ? "Productos con descuento:" + con.slice(0, 6).map(tarjetaProducto).join("") : "");
    },
    carta() {
      const cats = (DATA.categorias || []).filter((c) => DATA.productos.some((p) => p.categoria === c));
      return `Tenemos estas categorías. Tocá una para ver los productos:<div class="chips">${cats.map((c) => `<button data-preg="¿Qué tienen en ${esc(c)}?">${esc(c)}</button>`).join("")}</div>`;
    },
    contacto() {
      return `Podés escribirnos por <a href="${linkWA()}" target="_blank" rel="noopener">WhatsApp</a>${N().instagram ? ` o seguirnos en <a href="https://instagram.com/${esc(N().instagram)}" target="_blank" rel="noopener">Instagram (@${esc(N().instagram)})</a>` : ""}.`;
    },
    ingredientes() {
      return `Para consultas sobre ingredientes, alergias o comidas aptas (vegetarianas, sin TACC, etc.), preferimos confirmártelo personalmente: <a href="${linkWA("Hola, quería consultar por ingredientes / alergias.")}" target="_blank" rel="noopener">escribinos por WhatsApp</a>.`;
    },
    saludo() {
      return "¡Hola! ¿En qué te puedo ayudar?";
    },
    gracias() {
      return `¡De nada! Cualquier otra consulta, acá estoy. Te esperamos en ${esc(nombreLocal())}.`;
    },
  };

  const INTENCIONES = [
    ["horario", ["horario", "horarios", "hora", "horas", "abren", "abre", "abierto", "abiertos", "cierran", "cierra", "cerrado", "atienden", "atencion", "domingo", "domingos", "feriado", "feriados"]],
    ["direccion", ["direccion", "donde", "ubicacion", "ubicados", "local", "llegar", "mapa", "estacion"]],
    ["pedir", ["pedir", "pido", "pedido", "pedidos", "encargar", "encargo", "comprar", "compro", "reservar"]],
    ["envio", ["envio", "envios", "envian", "delivery", "domicilio", "mandan", "llevan", "reparto", "retiro", "retirar", "buscar", "zona", "zonas"]],
    ["pago", ["pago", "pagos", "pagar", "pagan", "tarjeta", "tarjetas", "efectivo", "transferencia", "mercadopago", "mercado", "debito", "credito", "cuotas"]],
    ["promos", ["promo", "promos", "promocion", "promociones", "descuento", "descuentos", "oferta", "ofertas", "off"]],
    ["carta", ["carta", "menu", "productos", "venden", "ofrecen", "categorias", "comida", "comidas", "catalogo"]],
    ["contacto", ["telefono", "whatsapp", "contacto", "instagram", "llamar", "numero", "celular", "mail"]],
    ["ingredientes", ["ingrediente", "ingredientes", "alergia", "alergias", "alergico", "celiaco", "celiacos", "tacc", "gluten", "vegano", "veganos", "vegana", "vegetariano", "vegetariana", "vegetarianos", "lactosa", "picante", "carne", "contiene", "lleva"]],
  ];

  const CLAVES = new Set(INTENCIONES.flatMap(([, k]) => k));

  function responder(pregunta) {
    const t = norm(pregunta);
    if (!t) return null;
    if (/^(gracias|muchas gracias|genial|perfecto|ok|listo|dale)\b/.test(t) && t.split(" ").length <= 4) return R.gracias();

    const intenciones = INTENCIONES.filter(([, k]) => tiene(t, k)).map(([n]) => n);
    const partes = [];

    // Ingredientes, alergias o dietas: se confirma siempre por WhatsApp.
    if (intenciones.includes("ingredientes") || /\b(vegan|vegetarian|celiac|alergi|alergic|intoleran|diabet)/.test(t)) return R.ingredientes();

    // Productos o categorías (salvo que la pregunta sea claramente de otro tema)
    const soloTema = intenciones.some((i) => ["horario", "direccion", "pedir", "envio", "pago", "contacto"].includes(i));
    const cat = categoriaPedida(t);
    let productos = buscarProductos(t);
    if (cat && !productos.porNombre) productos = DATA.productos.filter((p) => p.categoria === cat);
    if (productos.length && !(soloTema && productos.length > 3)) {
      const disponibles = productos.filter((p) => !sinStock(p)), agotados = productos.filter(sinStock);
      const lista = [...disponibles, ...agotados];
      partes.push(
        (cat && !productos.porNombre && productos.length > 1 ? `En <b>${esc(cat)}</b> tenemos:` : productos.length > 1 ? "Encontré estos productos:" : "") +
          lista.slice(0, 8).map(tarjetaProducto).join("") +
          (lista.length > 8 ? `<p>…y ${lista.length - 8} más. Podés verlos todos en la tienda.</p>` : ""),
      );
    }

    for (const i of intenciones) if (!(i === "carta" && productos.length)) partes.push(R[i](t));
    if (partes.length) return partes.join("<hr>");

    if (/^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|que tal)\b/.test(t)) return R.saludo();
    return null;
  }

  // ---------- interfaz ----------
  const css = `
  :host{all:initial;font-family:var(--body,"Manrope",-apple-system,"Segoe UI",Roboto,sans-serif);--ac:var(--or,#D9772E);--ac2:var(--or-2,#F0954A);--fondo:var(--bg-2,#131A1F);--caja:var(--card,#172028);--tx:var(--ink,#F3EDE4);--tx2:var(--ink-2,#AFA79C);--ln:var(--line,#26313A)}
  *{box-sizing:border-box}
  .abrir{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:65;display:flex;align-items:center;gap:8px;border:1px solid var(--ln);background:var(--caja);color:var(--tx);border-radius:999px;padding:12px 18px 12px 14px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 12px 28px -8px rgba(0,0,0,.6);transition:transform .25s ease,bottom .25s ease}
  .abrir:hover{border-color:var(--ac)}
  .abrir svg{width:22px;height:22px;color:var(--ac2)}
  :host(.con-barra) .abrir{bottom:calc(168px + env(safe-area-inset-bottom,0px))}
  :host(.oculto) .abrir{transform:scale(0);pointer-events:none}
  .panel{position:fixed;right:max(16px,env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:85;width:min(410px,calc(100vw - 32px));height:min(640px,calc(100dvh - 32px));display:none;flex-direction:column;background:var(--fondo);color:var(--tx);border:1px solid var(--ln);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px -16px rgba(0,0,0,.7);font-size:16px;line-height:1.5}
  .panel.abierto{display:flex}
  .cab{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--ln)}
  .cab .t{flex:1;min-width:0}
  .cab b{display:block;font-size:17px}
  .cab small{color:var(--tx2);font-size:13px}
  .cerrar{width:40px;height:40px;border-radius:12px;border:1px solid var(--ln);background:none;color:var(--tx);font-size:18px;cursor:pointer}
  .msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px}
  .m{max-width:92%;padding:12px 14px;border-radius:16px;word-wrap:break-word}
  .m.bot{align-self:flex-start;background:var(--caja);border-bottom-left-radius:4px}
  .m.yo{align-self:flex-end;background:var(--ac);color:#111;font-weight:600;border-bottom-right-radius:4px}
  .m a{color:var(--ac2);font-weight:700}
  .m ol{margin:6px 0;padding-left:20px}
  .m li{margin:3px 0}
  .m hr{border:0;border-top:1px solid var(--ln);margin:12px 0}
  .m p{margin:8px 0 0}
  .prod{margin-top:10px;padding:10px 12px;border:1px solid var(--ln);border-radius:12px;background:rgba(0,0,0,.12)}
  .pn b{font-size:16px}
  .peso{color:var(--tx2);font-size:14px}
  .pd{color:var(--tx2);font-size:14px;margin-top:2px}
  .pp{margin-top:6px;font-weight:800;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .pp s{color:var(--tx2);font-weight:500;font-size:14px}
  .tag{font-size:12.5px;font-weight:800;border-radius:999px;padding:2px 9px}
  .tag.no{background:rgba(229,72,77,.16);color:#FFB4A1}
  .tag.poco{background:rgba(229,72,77,.16);color:#FFB4A1}
  .tag.promo{background:#E5484D;color:#fff}
  .ver{margin-top:8px;border:1px solid var(--ac);background:none;color:var(--ac2);border-radius:10px;padding:8px 12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
  .ver:hover{background:var(--ac);color:#111}
  .chips,.sug{display:flex;flex-wrap:wrap;gap:8px}
  .chips{margin-top:10px}
  .sug{padding:0 16px 12px}
  .chips button,.sug button{border:1px solid var(--ln);background:none;color:var(--tx);border-radius:999px;padding:9px 14px;font:inherit;font-size:14.5px;font-weight:600;cursor:pointer}
  .chips button:hover,.sug button:hover{border-color:var(--ac);color:var(--ac2)}
  .form{display:flex;gap:8px;padding:12px;border-top:1px solid var(--ln)}
  .form input{flex:1;min-width:0;background:var(--caja);border:1px solid var(--ln);border-radius:12px;color:var(--tx);font:inherit;font-size:16px;padding:12px 14px;outline:none}
  .form input:focus{border-color:var(--ac)}
  .form button{border:0;border-radius:12px;background:var(--ac);color:#111;font:inherit;font-size:16px;font-weight:800;padding:0 18px;cursor:pointer}
  @media (max-width:600px){.abrir{padding:12px 16px 12px 12px}.panel{right:12px;left:12px;width:auto;bottom:12px;height:calc(100dvh - 24px)}}
  `;

  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${css}</style>
    <button class="abrir" aria-label="Abrir consultas">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5"/><path d="M12 16.5h.01"/></svg>
      Consultas
    </button>
    <div class="panel" role="dialog" aria-label="Consultas">
      <div class="cab"><div class="t"><b>Consultas</b><small>Respuestas al instante sobre la tienda</small></div><button class="cerrar" aria-label="Cerrar">✕</button></div>
      <div class="msgs" aria-live="polite"></div>
      <div class="sug">
        <button data-preg="¿Cuál es el horario?">Horarios</button>
        <button data-preg="¿Dónde están?">Dirección</button>
        <button data-preg="¿Qué productos tienen?">Ver la carta</button>
        <button data-preg="¿Cómo hago un pedido?">Cómo pedir</button>
        <button data-preg="¿Hacen envíos?">Envíos</button>
        <button data-preg="¿Tienen promociones?">Promociones</button>
      </div>
      <form class="form"><input placeholder="Escribí tu pregunta…" aria-label="Tu pregunta" maxlength="300"><button type="submit">Enviar</button></form>
    </div>`;
  document.body.appendChild(host);

  const $ = (s) => root.querySelector(s);
  const panel = $(".panel"), msgs = $(".msgs"), input = $(".form input");

  function burbuja(clase, html) {
    const d = document.createElement("div");
    d.className = "m " + clase;
    if (clase === "yo") d.textContent = html; else d.innerHTML = html;
    msgs.appendChild(d);
    d.scrollIntoView({ block: "nearest" });
    if (clase === "bot") d.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function preguntar(texto) {
    texto = String(texto || "").trim();
    if (!texto) return;
    burbuja("yo", texto);
    input.value = "";
    try {
      if (!DATA) await cargar();
    } catch (e) {
      return burbuja("bot", `No pude cargar la información en este momento. <a href="${linkWA(texto)}" target="_blank" rel="noopener">Consultanos por WhatsApp</a>.`);
    }
    const r = responder(texto);
    burbuja("bot", r || `No estoy seguro de cómo responder eso. <a href="${linkWA("Hola, quería consultar: " + texto)}" target="_blank" rel="noopener">Mandanos tu consulta por WhatsApp</a> y te respondemos a la brevedad.`);
  }

  let saludado = false;
  async function abrir() {
    panel.classList.add("abierto");
    if (!saludado) {
      saludado = true;
      try { if (!DATA) await cargar(); } catch (e) {}
      const aviso = DATA && N().aviso ? `<p><b>Aviso:</b> ${esc(N().aviso)}</p>` : "";
      burbuja("bot", `¡Hola! Soy el asistente de ${esc(DATA ? nombreLocal() : "la tienda")}. Puedo ayudarte con horarios, dirección, productos, precios y cómo hacer tu pedido. Elegí una opción o escribí tu pregunta.${aviso}`);
    }
    if (window.matchMedia("(min-width: 601px)").matches) input.focus();
  }
  const cerrar = () => panel.classList.remove("abierto");

  // Lleva a la tarjeta del producto en la tienda y la resalta, para agregarlo con el botón de siempre.
  function irAProducto(id) {
    const card = document.querySelector(`[data-card="${CSS.escape(id)}"]`);
    cerrar();
    if (!card) { if (typeof window.openZoom === "function") window.openZoom(id); return; }
    if (typeof window.goTo === "function") window.goTo(card);
    else card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.animate(
      [{ boxShadow: "0 0 0 0 rgba(217,119,46,0)" }, { boxShadow: "0 0 0 4px rgba(217,119,46,.9)" }, { boxShadow: "0 0 0 0 rgba(217,119,46,0)" }],
      { duration: 1400, iterations: 2, delay: 400 },
    );
  }

  $(".abrir").addEventListener("click", abrir);
  $(".cerrar").addEventListener("click", cerrar);
  $(".form").addEventListener("submit", (e) => { e.preventDefault(); preguntar(input.value); });
  root.addEventListener("click", (e) => {
    const p = e.target.closest("[data-preg]");
    if (p) return preguntar(p.dataset.preg);
    const v = e.target.closest("[data-ver]");
    if (v) irAProducto(v.dataset.ver);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") cerrar(); });

  // Acompaña al botón de WhatsApp: sube cuando aparece la barra del pedido y se oculta con el carrito abierto.
  const sync = () => {
    host.classList.toggle("con-barra", document.body.classList.contains("has-bar"));
    host.classList.toggle("oculto", document.body.classList.contains("drawer-open"));
  };
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  sync();

  // Para probar desde la consola: AsistenteArame.responder("¿hasta qué hora abren?")
  window.AsistenteArame = { abrir, preguntar, responder: (t) => (DATA ? responder(t) : null), cargar };
})();
