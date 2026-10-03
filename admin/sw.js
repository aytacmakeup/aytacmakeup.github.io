// Service Worker de la app madre (Aytacmakeup).
// Se encarga de DOS cosas, y solo de estas dos:
//   1) Recibir una notificación push aunque la app esté cerrada, y mostrarla.
//   2) Cuando se toca esa notificación, abrir o enfocar la app en la lista de pedidos.
// No guarda datos, no funciona sin conexión (no es un "modo offline"), y no interfiere con
// nada más de la app: si algún día se quita este archivo, la app sigue funcionando igual,
// solo se dejarían de recibir notificaciones con la app cerrada.

// Necesario para que el navegador considere la app "instalable" como PWA. No agrega modo
// sin conexión: deja pasar cada solicitud tal cual, directo a la red, igual que si este
// archivo no existiera. Los datos del negocio siguen viniendo siempre en vivo de Supabase.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch (e) {
    datos = { title: 'Nuevo pedido', body: event.data ? event.data.text() : '' };
  }

  const titulo = datos.title || 'Nuevo pedido';
  const opciones = {
    body: datos.body || '',
    tag: datos.tag || 'pedido',
    renotify: true,
    // Este service worker vive DENTRO de /admin/, separado por completo del catálogo (que
    // está en otra carpeta y ni siquiera sabe que esto existe). Por eso self.registration.scope
    // ya apunta directo a la app madre, sin riesgo de confundirse con el catálogo.
    data: { url: datos.url || (self.registration.scope + '#pedidos') }
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlDestino = (event.notification.data && event.notification.data.url) || (self.registration.scope + '#pedidos');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
      // Como este service worker vive dentro de /admin/, su alcance (scope) ya está limitado
      // a esa carpeta: ni siquiera puede "ver" pestañas del catálogo, así que esta búsqueda
      // solo puede encontrar pestañas de la app madre. Se filtra por la carpeta /admin/ (no
      // por un nombre de archivo exacto), para que funcione sin importar si el navegador
      // muestra la URL como ".../admin/" o ".../admin/index.html".
      const clienteAdmin = listaClientes.find((c) => c.url.includes('/admin/'));
      if (clienteAdmin && 'focus' in clienteAdmin) {
        clienteAdmin.postMessage({ type: 'ABRIR_NOTIFICACIONES_PEDIDOS' });
        return clienteAdmin.focus();
      }
      // No había ninguna pestaña de la app madre abierta: se abre una nueva, directo en pedidos.
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlDestino);
      }
    })
  );
});
