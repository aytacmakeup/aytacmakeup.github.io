// Protege SOLO /admin.html con una contraseña compartida. El catálogo (index.html) nunca
// pasa por aquí, porque netlify.toml solo apunta esta función a esa única ruta.
//
// Esto es una puerta extra de privacidad (para que ni la pantalla de inicio de sesión sea
// visible para cualquiera), NO el candado real de tus datos — ese ya lo pone Supabase con tu
// correo y contraseña, pase lo que pase aquí. Es una sola contraseña compartida (no hay
// usuarios individuales), así que no la uses para nada más sensible que esto.
//
// Para configurarla: Netlify → Site configuration → Environment variables → agrega una
// llamada exactamente "ADMIN_PAGE_PASSWORD" con la contraseña que quieras.

import type { Config, Context } from "@netlify/edge-functions";

const NOMBRE_COOKIE = "acceso_admin";

async function hashear(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function paginaFormulario(opciones: { error?: boolean } = {}): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acceso privado</title>
<style>
  :root{color-scheme:light;}
  body{font-family:system-ui,-apple-system,sans-serif;background:#FFF9F0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box;}
  form{background:#fff;padding:32px 26px;border-radius:18px;max-width:320px;width:100%;box-shadow:0 8px 28px rgba(0,0,0,.10);text-align:center;}
  .icono{width:56px;height:56px;border-radius:50%;background:#2A1B12;color:#F5C542;display:flex;align-items:center;justify-content:center;font-size:24px;margin:0 auto 16px;}
  h1{font-size:19px;color:#2A1B12;margin:0 0 6px;}
  p.sub{font-size:13px;color:#7a7a7a;margin:0 0 22px;line-height:1.45;}
  input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid #ddd;font-size:15px;margin-bottom:14px;text-align:center;}
  input:focus{outline:none;border-color:#2A1B12;}
  button{width:100%;padding:13px;border:none;border-radius:12px;background:#2A1B12;color:#F5C542;font-weight:600;font-size:15px;}
  .err{color:#b23b3b;font-size:12.5px;margin:-8px 0 14px;}
</style>
</head>
<body>
  <form method="POST">
    <div class="icono">&#128274;</div>
    <h1>Acceso privado</h1>
    <p class="sub">Esta página es solo para la administración del negocio.</p>
    ${opciones.error ? '<p class="err">Código incorrecto. Intenta de nuevo.</p>' : ""}
    <input type="password" name="password" placeholder="Código de acceso" autofocus required>
    <button type="submit">Entrar</button>
  </form>
</body>
</html>`;
}

export default async (request: Request, context: Context) => {
  const password = Netlify.env.get("ADMIN_PAGE_PASSWORD");

  // Nunca deja pasar "por accidente": si no configuraste la contraseña todavía, bloquea
  // por completo en vez de dejar la página abierta sin querer.
  if (!password) {
    return new Response(
      "Esta página todavía no está configurada. Falta la variable de entorno ADMIN_PAGE_PASSWORD en Netlify.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const url = new URL(request.url);

  // Cerrar sesión: /admin.html?salir=1
  if (url.searchParams.get("salir") === "1") {
    context.cookies.delete(NOMBRE_COOKIE);
    return new Response(paginaFormulario(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const hashEsperado = await hashear(password);

  // ¿Ya tiene la cookie de una sesión válida?
  const cookieActual = context.cookies.get(NOMBRE_COOKIE);
  if (cookieActual === hashEsperado) {
    return; // deja pasar, Netlify sirve admin.html normalmente
  }

  if (request.method === "POST") {
    const cuerpo = await request.text();
    const params = new URLSearchParams(cuerpo);
    const intento = params.get("password") || "";
    const hashIntento = await hashear(intento);

    if (hashIntento === hashEsperado) {
      context.cookies.set({
        name: NOMBRE_COOKIE,
        value: hashEsperado,
        path: "/",
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 días
        sameSite: "Strict",
        secure: true,
      });
      return Response.redirect(url.origin + "/admin.html", 302);
    }

    return new Response(paginaFormulario({ error: true }), {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return new Response(paginaFormulario(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
};

export const config: Config = {
  path: "/admin.html",
};
