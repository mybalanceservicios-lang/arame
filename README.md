# Arame · Tienda web

Tienda online de comida casera. Es un solo archivo (`index.html`), sin servidor ni base de datos: el cliente arma su pedido y lo envía por WhatsApp.

## Qué tiene

- Menú con categorías, buscador y etiquetas (vegetariano, más pedido)
- Carrito con cantidades (se guarda si el cliente cierra la página)
- Envío o retiro, pedido mínimo y envío gratis desde cierto monto
- Pedido armado automáticamente en un mensaje de WhatsApp
- Horarios con aviso de "abierto / cerrado ahora"
- Funciona en celular y computadora

## Cómo personalizarla

Abrí `index.html` y buscá el bloque `CONFIGURACIÓN` dentro del `<script>`:

- `CONFIG.whatsapp`: tu número con código de país, sin `+` (ej. `5491122334455`)
- `CONFIG.address`, `shipCost`, `freeShipFrom`, `minOrderShip`, `hours`
- `PRODUCTS`: nombre, descripción, precio y categoría de cada plato
- `CATS`: las categorías del menú

## Publicarla

Activá GitHub Pages (Settings → Pages → rama principal, carpeta raíz) o subí `index.html` a cualquier hosting.
