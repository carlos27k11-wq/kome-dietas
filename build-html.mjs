import fs from "fs";
const [, , URL_, KEY] = process.argv;
const css = fs.readFileSync("src/styles.css", "utf8");
const vendor = fs.readFileSync(".tmp-vendor.js", "utf8");
const app = fs.readFileSync(".tmp-app.js", "utf8");

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#14121F">
<title>米 kome — dietas en familia</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Silkscreen:wght@400;700&family=Zen+Maru+Gothic:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%2314121F'/%3E%3Crect x='3' y='7' width='10' height='5' fill='%23EDE4D3'/%3E%3Crect x='2' y='7' width='12' height='1' fill='%23F09BB6'/%3E%3Crect x='4' y='4' width='2' height='2' fill='%239CC97F'/%3E%3Crect x='7' y='3' width='2' height='2' fill='%239CC97F'/%3E%3C/svg%3E">

<!-- ==========================================================
     米 kome — la app entera en un archivo.

     1. ESTILOS      el diseño, aquí abajo. Toca lo que quieras.
     2. CONFIG       tu Supabase.
     3. LIBRERÍAS    React, Supabase y el lector de códigos. Comprimido: no tocar.
     4. LA APP       el código de la aplicación, legible y comentado.

     Ábrelo con doble clic para mirarlo, pero para trabajar de verdad
     levanta un servidor local en esta carpeta:
         npx serve
     y entra en http://localhost:3000 — así funciona también la cámara.
     ========================================================== -->

<style>
${css}
</style>
</head>
<body>
<div id="root"></div>

<!-- ==================== 2. CONFIG ==================== -->
<script>
  window.KOME_CONFIG = {
    SUPABASE_URL: ${JSON.stringify(URL_)},
    SUPABASE_ANON_KEY: ${JSON.stringify(KEY)}
  };
  window.addEventListener("error", function (e) {
    var r = document.getElementById("root");
    if (r && !r.firstChild) {
      r.innerHTML = '<div style="padding:24px;font-family:monospace;color:#ede4d3">' +
        '<h2>Algo se ha roto al arrancar</h2><p style="color:#e5875e">' + e.message + '</p></div>';
    }
  });
</script>

<!-- ============= 3. LIBRERÍAS (comprimidas, no tocar) ============= -->
<script>
${vendor}
</script>

<!-- ==================== 4. LA APP ==================== -->
<script>
${app}
</script>
</body>
</html>
`;
fs.writeFileSync("kome.html", html);
