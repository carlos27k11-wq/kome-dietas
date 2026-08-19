# 米 kome — dietas en familia

App de dietas para casa: recetario con fotos, diario de macros y registro de progreso.
Un perfil por persona, sin contraseñas, estilo Netflix.

## Qué hace

**Hoy** — Diario del día por comidas (desayuno, comida, merienda, cena, extras), con objetivo
de kcal repartido por comida. Barras de proteína, carbos y grasa, más el detalle de fibra,
azúcares, grasa saturada y sodio. Registro de agua y de pasos (de mil en mil). Lectura automática del día con avisos
nutricionales. Copiar el día anterior de un toque.

**Recetas** — Biblioteca de platos con foto grande; al pulsar se amplía. Cada receta se monta
con ingredientes reales (búsqueda local + Open Food Facts) y la app calcula los macros por
ración. Se marca a quién de la casa le gusta cada plato y se puede filtrar por persona o ver
solo lo que gusta a todos. Se añaden al diario en un toque.

**Plan** — Calendario semanal con comida y cena de cada día. Se eligen recetas (filtrando por
quién se las come) o se apunta texto libre. Copia la semana anterior de un toque. Incluye la
lista de la compra de la casa: apuntas lo que falte, se tacha al comprarlo y la ve toda la
familia. También puedes traer los ingredientes de las recetas de la semana (sumados y con
cantidades) o los de una receta suelta desde su ficha.

**Registro** — Gráfico de kcal por día frente al objetivo (7 / 30 / 90 días), medias de macros,
constancia, racha, balance energético acumulado y su equivalente en kg. Gráficos de agua y de
pasos diarios con sus medias. Seguimiento de peso con línea de tendencia.

**Perfil** — Sexo, edad, altura, peso, actividad y objetivo. Calcula el metabolismo basal
(Mifflin-St Jeor), el gasto total y reparte los macros: proteína y grasa por kilo de peso,
carbohidrato con la energía restante. Con topes de seguridad: nunca por debajo del basal ni de
1.200 / 1.500 kcal, y grasa mínima de 0,6 g/kg.

Alimentos: base local compartida + Open Food Facts (búsqueda por texto y por código de barras
con la cámara).

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
4. En **Site configuration → Environment variables** añade:

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://qznmsqubnavzgyrnfgfr.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bm1zcXVibmF2emd5cm5mZ2ZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNzczODAsImV4cCI6MjEwMjY1MzM4MH0.IzYC2lsRK-CH2eYhTOAEhjL1NyhDsftGGnDU8pv4g44` |

5. Deploy. El escáner de códigos necesita HTTPS: en Netlify ya lo es.

## Base de datos

Ya está creada en el proyecto Supabase `dietas-familia`. El esquema completo está en
`supabase/schema.sql` por si necesitas rehacerlo.

Tablas: `profiles`, `foods`, `recipes`, `recipe_ingredients`, `diary_entries`, `water_logs`,
`weight_logs`, y la vista `daily_totals`. Bucket `recipe-photos` para las fotos.

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
