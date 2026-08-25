# 米 kome — dietas en familia

App de dietas para casa: recetario con fotos, diario de macros y registro de progreso.
Un perfil por persona, sin contraseñas, estilo Netflix.

## Qué hace

**Hoy** — Diario del día por comidas (desayuno, comida, merienda, cena, extras), con objetivo
de kcal repartido por comida. Barras de proteína, carbos y grasa, más el detalle de fibra,
azúcares, grasa saturada y sodio. Registro de agua (vasos de 250 ml) y de pasos (de mil en mil), o metiendo el total del día a
mano si lo llevas apuntado en otro sitio. Lectura automática del día con avisos
nutricionales. Copiar el día anterior de un toque.

**Recetario** — Dos subpestañas.

*Recetas*: biblioteca de platos con foto grande; al pulsar se amplía. Cada receta se monta con
ingredientes reales y la app calcula los macros por ración. Para meter un ingrediente basta con
buscarlo por el nombre (despensa de casa + Open Food Facts) o pulsar la cámara y **escanear su
código de barras**. Si el ingrediente no lo conoce nadie, se crea ahí mismo sin salir de la
receta y se usa al momento. Se marca a quién de la casa le gusta cada plato y se puede filtrar por
persona o ver solo lo que gusta a todos. Se añaden al diario en un toque.

*Ingredientes*: la despensa de casa. Se van metiendo **escaneando el código de barras** de los
productos: si están en Open Food Facts se guardan solos con todos sus valores y, si no, se
rellena la etiqueta a mano. Al alta manual también se le puede pegar su código de barras y
**leer la tabla nutricional con la cámara** (ver abajo), que es lo que más se tarda en teclear.
Desde aquí se corrigen y se borran. Lo que hay en esta pestaña es lo que luego aparece al
montar una receta.

**Plan** — Calendario semanal con comida y cena de cada día. Se eligen recetas (filtrando por
quién se las come) o se apunta texto libre. Copia la semana anterior de un toque. Incluye la
lista de la compra de la casa: se abre a pantalla completa, apuntas lo que falte, se tacha al
comprarlo y la ve toda la familia. Desde la ficha de una receta puedes mandar sus ingredientes
a la lista.

**Registro** — Gráfico de kcal por día frente al objetivo (7 / 30 / 90 días), medias de macros,
constancia, racha, balance energético acumulado y su equivalente en kg. Gráficos de agua y de
pasos diarios con sus medias. Seguimiento de peso con línea de tendencia. Los días en los que
no apuntas nada no entran en ninguna media: cada media cuenta solo los días con registro y
dice cuántos son.

**Perfil** — Icono (más de cien, agrupados por temas), color, **tema de la app**, sexo,
edad, altura, peso, actividad y objetivo. Calcula el metabolismo basal
(Mifflin-St Jeor), el gasto total y reparte los macros: proteína y grasa por kilo de peso,
carbohidrato con la energía restante. Con topes de seguridad: nunca por debajo del basal ni de
1.200 / 1.500 kcal, y grasa mínima de 0,6 g/kg.

Alimentos: despensa de casa + catálogo de Mercadona y Consum (12.000 productos guardados en
vuestro Supabase) + Open Food Facts para todo lo demás. Se busca por texto o por código de
barras con la cámara.

## El catálogo de Mercadona y Consum

Dentro de la app hay **12.000 productos de Mercadona y de Consum** ya cargados, con su código de
barras y sus valores nutricionales. Salen al buscar por nombre (sección *Mercadona y Consum*) y
al escanear un código, antes de salir a internet. Así va rápido y sigue funcionando aunque el
servidor de Open Food Facts esté caído, que pasa a menudo.

Viven en la tabla `catalog_foods` de Supabase, que es **solo de lectura**: no es tu despensa. Un
producto solo entra en `foods` cuando lo eliges para una receta o para el diario.

Para volver a bajarlo o actualizarlo:

```bash
node scripts/catalogo.mjs        # baja de Open Food Facts → data/catalogo-es.json
node scripts/subir-catalogo.mjs  # lo sube a Supabase (necesita las variables de .env.production)
```

El segundo pide permiso de escritura sobre `catalog_foods`, que está cerrado: se abre y se
vuelve a cerrar con una política temporal en Supabase (ver `supabase/schema.sql`).

## El lector de etiquetas

En cualquier alta o corrección de un ingrediente hay un botón **📸 Leer la tabla nutricional**.
Apuntas con la cámara a la tabla de información nutricional del envase, encajas la tabla dentro
del marco y disparas (o eliges una foto que ya tengas). La app lee los valores por 100 g
—kcal, proteína, carbos, grasa, fibra, azúcares, saturadas, sal y el tamaño de la ración— y
rellena el formulario solo.

Los valores que ha puesto la cámara se marcan con el borde en ámbar: **hay que repasarlos**.
Un número que no cuadre se cambia a mano como siempre, y en cuanto lo tocas deja de estar
marcado. Si la foto sale mal, "Repetir la foto"; y con "Ver texto" se ve lo que ha leído tal cual.

Lo que conviene saber:

- Lee **en el móvil**, sin mandar la foto a ningún sitio. Usa
  [tesseract.js](https://tesseract.projectnaptha.com), que se descarga de internet la primera
  vez (unos megas) y luego se queda en la caché del navegador.
- Sale mejor **de cerca, con luz y con la tabla recta**. Las etiquetas arrugadas o con brillos
  se leen regular.
- De las dos columnas (por 100 g / por ración) coge la de **100 g**, aunque vengan al revés.
- Hace un repaso de sentido común: si los macros no cuadran con las kcal, si las saturadas
  salen mayores que la grasa o si todo junto pasa de 100 g, corrige la coma de sitio. Aun así,
  repásalo.

## Escanear para no buscar

Todo ingrediente puede llevar su **código de barras**, también los que metes a mano. Con el
código guardado, la próxima vez que lo quieras meter en una receta o en el diario del día no
hace falta buscarlo por el nombre: apuntas con la cámara y aparece.

**Por qué antes no leía casi nunca:** la librería que se usaba descifraba una copia del vídeo
encogida al tamaño del recuadro que se ve en pantalla —unos 330 píxeles—, así que tiraba a la
basura toda la resolución de la cámara. Con eso, un código de barras solo se leía si ocupaba más
de media pantalla. Ahora se descifra el fotograma **tal cual sale de la cámara** (1920 px), y
basta con que el código ocupe una quinta parte del encuadre. Medido con códigos de prueba:

| Parte del encuadre que ocupa el código | Antes (330 px) | Ahora (nativo) |
|---|---|---|
| 20 % | no lee | **lee** |
| 30 % | no lee | **lee** |
| 45 % | no lee | **lee** |
| 60 % o más | lee | **lee** |

El lector prueba por este orden:

1. **El lector del propio móvil** (`BarcodeDetector`), que trabaja sobre el vídeo a resolución
   completa. Lo tienen Chrome y Android; Safari no.
2. **zxing en WebAssembly** sobre la franja central del fotograma, a la resolución de la cámara.
   Tarda tres milisegundos por fotograma, así que va mirando unas diez veces por segundo. Se
   descarga de un CDN la primera vez y se queda en la caché.
3. **Una foto al código**: la cámara del móvil dispara con autoenfoque y se descifra la foto
   entera. Es la salida buena cuando la luz es mala o el envase está arrugado.
4. Y si nada funciona, **se escribe el número a mano**: con el catálogo cargado se encuentra
   igual de bien.

Si la cámara deja controlar el zoom, sale un mando debajo del vídeo: acercar el código es lo que
más ayuda, más que la luz.

## Temas

Cada perfil elige cómo se ve la app y queda guardado en su ficha: al entrar con ese perfil se
pone solo, sin tocar nada.

- **Kome** — el original: oscuro, con píxeles, la ventana que cambia con la hora y los
  detalles en japonés.
- **Claro y grande** — pensado para que se lea sin esfuerzo. Fondo claro, texto casi negro,
  tipografía más grande (Inter), botones y campos más altos, colores oscurecidos para que
  contrasten, y ni una palabra en japonés. Sigue siendo un diseño con tarjetas y aire, solo
  que minimalista.

Se elige en **Perfil → Aspecto de la app** (o al crear el perfil). El cambio se ve al momento
y se fija al guardar. Vive en la columna `theme` de la tabla `profiles`.

## Poner en marcha

```bash
npm install
cp .env.example .env
npm run dev
```

## Subir a Netlify

1. Sube la carpeta a un repositorio de GitHub.
2. En Netlify: **Add new site → Import an existing project** y elige el repo.
3. Build command `npm run build`, publish directory `dist` (ya está en `netlify.toml`).
4. No hace falta tocar variables de entorno: las credenciales van en `.env.production`, que
   Vite lee al compilar. Si algún día cambian, se ponen ahí o en **Site configuration →
   Environment variables** como `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

5. Deploy. El escáner de códigos necesita HTTPS: en Netlify ya lo es.

Cada push a `main` vuelve a desplegar solo.

## Base de datos

Ya está creada en el proyecto Supabase `dietas-familia`. El esquema completo está en
`supabase/schema.sql` por si necesitas rehacerlo.

Tablas: `profiles` (con `theme`), `foods`, `recipes`, `recipe_ingredients`, `diary_entries`,
`water_logs`, `weight_logs`, `step_logs`, `meal_plan`, `shopping_items`, y las vistas
`daily_totals`, `daily_water` y `daily_steps`. Bucket `recipe-photos` para las fotos.

**Sobre la seguridad:** al no haber login, la clave pública da acceso de lectura y escritura a
los datos de la familia. Es lo que pediste (elegir perfil y entrar), y es razonable para uso
doméstico, pero no publiques la URL en sitios abiertos. Si algún día quieres cerrarlo, se
añade Supabase Auth y se cambian las políticas de `using (true)` a `using (auth.uid() is not null)`.

## Créditos

Datos de alimentos: [Open Food Facts](https://es.openfoodfacts.org), licencia ODbL.
Tipografías: DotGothic16, Zen Maru Gothic y Silkscreen (Google Fonts).
Códigos de barras: [zxing-wasm](https://github.com/Sec-ant/zxing-wasm). Etiquetas:
[tesseract.js](https://tesseract.projectnaptha.com).

## Trabajar con un solo archivo HTML

`kome.html` es la app entera en un archivo: estilos, librerías y código. No necesita
compilar nada ni gastar despliegues de Netlify.

Para editar y ver los cambios: abre el archivo con cualquier editor, guarda y refresca el
navegador. Dentro está dividido en cuatro bloques marcados con comentarios (estilos, config,
librerías y la app).

Para que funcione la **cámara del escáner** hace falta un servidor local; el navegador
bloquea la cámara en archivos abiertos con doble clic:

```bash
cd carpeta-donde-esté-kome.html
npx serve          # o: python3 -m http.server 8000
```

y entra en `http://localhost:3000`. Cuando esté a tu gusto, súbelo a Netlify (un solo
despliegue) arrastrando el archivo renombrado como `index.html`.

Si prefieres editar el código ordenado en `src/` y regenerar el HTML de una pieza:

```bash
./build-html.sh
```
