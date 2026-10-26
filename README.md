# Aramé · Tienda web

Tienda online de Aramé (cocina armenia, Martínez). El cliente arma el pedido y lo manda por WhatsApp. No hay pasarela de pago: el pago se coordina por WhatsApp.

## Archivos

- `index.html`: la tienda.
- `admin.html`: el panel para editar el catálogo (se entra con PIN).
- `catalogo.json`: productos, precios y datos del negocio. Lo modifica el panel.
- `fotos/`: fotos de los productos, subidas desde el panel.
- `admin/llave.json`: lo crea el panel la primera vez. Es el permiso de GitHub cifrado con el PIN.

## Publicar la web (una sola vez)

1. En GitHub, entrá al repositorio → **Settings → Pages**.
2. En **Source** elegí **Deploy from a branch**, la rama principal del repositorio y la carpeta **/ (root)**. Guardá.
3. En uno o dos minutos la web queda en `https://mybalanceservicios-lang.github.io/arame/`.
   El panel queda en `https://mybalanceservicios-lang.github.io/arame/admin.html`.

## Configurar el panel (una sola vez)

Abrí `admin.html` y seguí los pasos que aparecen en pantalla: crear un token de GitHub con permiso solo sobre este repositorio y elegir un PIN numérico. Después, cualquiera que sepa el PIN puede editar desde cualquier celular o computadora.

Usá un PIN de 8 números o más y no lo compartas.

## Editar el catálogo

En el panel, cada producto es un cuadrado con un botón **Editar**: nombre, descripción, peso o presentación, precio, unidad de venta, categoría, foto y stock. Los cambios aparecen en la tienda en 1 o 2 minutos.

En **Datos del negocio** se cambia el WhatsApp que recibe los pedidos, la dirección, el horario, un aviso destacado y el orden de las categorías.

## Asistente de consultas

El botón **Consultas** de la tienda (`asistente.js`) responde al instante horarios, dirección, productos, precios, stock, promociones y cómo hacer el pedido. No usa servicios pagos ni servidor: lee `catalogo.json`, así que cualquier cambio hecho en el panel se refleja solo.

- Lo que no sabe responder (ingredientes, alergias, cosas que no están en el catálogo) lo deriva a WhatsApp.
- En el panel, en **Datos del negocio**, los campos **Envíos** y **Formas de pago** son lo que contesta el asistente cuando le preguntan por eso. Si quedan vacíos, responde que se coordina por WhatsApp.
- El horario se escribe como hasta ahora (por ejemplo `Lunes a sábado · 11 a 15 h y 17 a 20 h`): con ese formato el asistente sabe decir si el local está abierto en ese momento.
