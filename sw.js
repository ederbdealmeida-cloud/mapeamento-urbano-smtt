const CACHE_NAME = "mui-smtt-v14";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Estratégia: TUDO da mesma origem (página, app.js, manifest) = network-first,
// ou seja, sempre busca a versão mais nova quando há internet, e só usa o
// cache como reserva quando estiver offline. Isso evita a necessidade de o
// usuário limpar o cache manualmente para receber atualizações do app.
// Recursos externos (mapas, gráficos) seguem a mesma lógica.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match("./index.html").then((cached) => cached || caches.match(req))
      )
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
