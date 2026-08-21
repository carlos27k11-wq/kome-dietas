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
código de barras**. Se marca a quién de la casa le gusta cada plato y se puede filtrar por
persona o ver solo lo que gusta a todos. Se añaden al diario en un toque.

*Ingredientes*: la despensa de casa. Se van metiendo **escaneando el código de barras** de los
productos: si están en Open Food Facts se guardan solos con todos sus valores y, si no, se
rellena la etiqueta a mano. Desde aquí se corrigen y se borran. Lo que hay en esta pestaña es
lo que luego aparece al montar una receta.

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

Alimentos: base local compartida + Open Food Facts (búsqueda por texto y por código de barras
con la cámara).

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
