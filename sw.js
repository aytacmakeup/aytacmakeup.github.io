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
    // Si no viene una URL específica en el aviso, se arma apuntando a admin.html dentro de
    // esta misma carpeta (self.registration.scope). El "#pedidos" es lo que hace que, al
    // tocar la notificación, la app abra directo la lista de pedidos en vez de la pantalla
    // de inicio. Antes esto apuntaba sin "admin.html", así que cuando no coincidía ninguna
    // pestaña ya abierta, terminaba abriendo el catálogo por error.
    data: { url: datos.url || (self.registration.scope + 'admin.html#pedidos') }
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlDestino = (event.notification.data && event.notification.data.url) || (self.registration.scope + 'admin.html#pedidos');

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((listaClientes) => {
      // Importante: el catálogo vive en el mismo sitio que la app madre, así que si estaba
      // abierto en otra pestaña, ANTES se tomaba por error como si fuera la app madre (se
      // enfocaba esa pestaña en vez de abrir la correcta). Ahora se busca específicamente
      // una pestaña cuya dirección contenga "admin.html".
      const clienteAdmin = listaClientes.find((c) => c.url.includes('admin.html'));
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
