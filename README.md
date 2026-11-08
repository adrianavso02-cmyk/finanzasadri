# Sincronización compartida de Adri Finanzas

La página original guarda en `localStorage`, que es privado de cada navegador. Para que todos los visitantes vean los mismos saldos y movimientos, este adaptador usa Firebase Authentication (Google) y Cloud Firestore.

## Importante: privacidad

Con estas reglas, **cualquier persona que visite la página puede leer las cuentas, saldos, transacciones y notas compartidas**. No guardes allí datos bancarios secretos ni comprobantes que no deban ser públicos. El adaptador no sincroniza la API key de Gemini ni imágenes (`imageBase64`): Firestore limita cada documento a 1 MiB y compartir comprobantes puede exponer información personal. El código de la contraseña actual del editor está visible en el HTML y no es una protección segura; el permiso real de escritura lo aplica Firestore, para la cuenta Google autorizada.

## Configuración necesaria

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) y registra una aplicación web.
2. Habilita **Authentication > Sign-in method > Google**. Agrega el dominio de tu página a **Authorized domains**.
3. Crea una base de datos de **Cloud Firestore**.
4. Copia `firebase-config.example.js` como `firebase-config.js` y reemplaza `apiKey`, `projectId`, `appId` y el correo de la cuenta Google autorizada. No hace falta mantener `firebase-config.js` como secreto; restringe la API key desde Google Cloud y configura correctamente las reglas.
5. En Firebase Console > Firestore > Rules, publica el contenido de `firestore.rules` sustituyendo el correo por el mismo correo Google autorizado.
6. En el HTML de la app, justo **después del script principal** (el que contiene `saveState()`), agrega antes de `</body>`:

   ```html
   <script src="/firebase-config.js"></script>
   <script src="/shared-storage.js"></script>
   ```

7. Publica `firebase-config.js` en el mismo sitio/directorio que `index.html`. Si el sitio se publica en GitHub Pages bajo una ruta de proyecto, ajusta las rutas `/firebase-config.js` y `/shared-storage.js` a rutas relativas (`./firebase-config.js` y `./shared-storage.js`).
8. Abre la página, conecta la cuenta Google autorizada, activa el modo editor existente y guarda un cambio. Desde entonces, los datos centrales se cargan para todos y los cambios se actualizan en los navegadores abiertos.

La nube es la fuente común: al visitar la página, los datos locales del navegador no sobrescriben los datos centrales. Si Firestore todavía no tiene un documento, inicia sesión y guarda un cambio para crearlo. Para migrar datos viejos que solo existen en un navegador, hazlo conscientemente después de revisar qué datos locales vas a publicar; no copies información privada.

## Archivos

- `shared-storage.js`: integra lectura en tiempo real y sincronización Firestore con las funciones `saveState()` y `updateUI()` de la página actual.
- `firebase-config.example.js`: plantilla, no credenciales de un proyecto real.
- `firestore.rules`: lectura pública y escritura restringida a una identidad Google.
