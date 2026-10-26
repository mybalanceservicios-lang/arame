# Importar el catálogo de WhatsApp de Aramé

Instrucciones para Claude, en una sesión que corre en la computadora del dueño de la cuenta y con acceso a su Chrome (Claude in Chrome), donde WhatsApp Web ya está abierto.

## Qué hacer

1. Abrí en Chrome el catálogo de Aramé: https://wa.me/c/266099279007866 (se abre en WhatsApp Web, en el chat de +54 9 11 6457-8338 → ícono de tienda → Catálogo).
2. Recorré todas las colecciones (por ejemplo "Entradas - Medzé") con "Ver todo" y entrá a cada producto.
3. De cada producto anotá: nombre, descripción completa, precio, colección y peso o presentación si figura en la descripción (por ejemplo "Peso aprox: 350gr" → `"peso": "350 g aprox."`, y sacalo de la descripción).
4. Descargá la foto más grande de cada producto (la de la ficha del producto, no la miniatura). Guardala en `fotos/` como JPG, con un nombre corto sin acentos (por ejemplo `fotos/hummus-mediano.jpg`), achicada a 1200 px de lado máximo.
5. Actualizá `catalogo.json`:
   - Cada producto va en `productos` con este formato:
     `{"id", "nombre", "descripcion", "peso", "precio", "unidad", "categoria", "seccion", "foto", "disponible"}`.
   - `precio` es un número sin puntos ni signo (8200). Si no tiene precio, `null`.
   - `unidad`: `"unidad"` salvo que diga docena, porción, kg, pote o bandeja.
   - `categoria`: el nombre de la colección de WhatsApp.
   - `seccion`: `"cocina"` para comida, `"almacen"` para aceites y productos de almacén, `"shishas"` para shishas y accesorios.
   - Si ya existe un producto con el mismo nombre (por ejemplo "Hummus Mediano"), actualizalo en vez de duplicarlo.
   - Borrá los productos que no estén en el catálogo de WhatsApp, menos los de las secciones almacén y shishas.
   - Agregá cada colección nueva a `categorias`, en el mismo orden que en WhatsApp.
   - No toques `negocio` ni `secciones`. `resenas` e `historia` se cambian solo como dice la parte de reseñas, más abajo.
6. Revisá que `catalogo.json` sea JSON válido y que cada `foto` apunte a un archivo que existe.
7. Hacé commit y push a la rama principal del repositorio.

## No hacer

- No mandes mensajes ni agregues nada al carrito de WhatsApp.
- No cambies `index.html` ni `admin.html`.

## Reseñas de Google

1. Abrí Google Maps y buscá **Aramé, Rawson 2021, Martínez**.
2. En la pestaña **Opiniones**, ordená por **Más relevantes** y copiá entre 10 y 15 reseñas de 4 o 5 estrellas, preferentemente las que nombran un plato.
3. Copiá el texto tal cual, sin cambiar palabras. Si es largo, usá una o dos frases completas del original.
4. Reemplazá `resenas` en `catalogo.json` con este formato:
   `{"texto": "...", "autor": "Nombre como figura en Google", "fuente": "Google", "plato": "Hummus"}`
   (`plato` va vacío si la reseña no habla de un plato).
5. Si la ficha muestra otra calificación o cantidad de opiniones, actualizá `historia.datos`.
