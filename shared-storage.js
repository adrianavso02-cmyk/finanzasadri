/* Adaptador Firebase/Firestore para la app de finanzas existente.
 * Cargar después del <script> principal de index.html.
 * Los datos financieros compartidos se leen públicamente; las escrituras
 * requieren iniciar sesión con la cuenta Google autorizada en firestore.rules.
 */
(() => {
  "use strict";

  const FIREBASE_VERSION = "10.14.1";
  const COLLECTION = "sharedData";
  const DOCUMENT = "main";
  const LOCAL_KEYS = ["adri_accounts", "adri_transactions", "adri_ves_rate", "adri_ves_rate_mode", "adri_bcv_rate_date"];
  let db;
  let auth;
  let originalSaveState;
  let cloudReady = false;
  let applyingCloud = false;
  let saving = false;
  let pendingSave = false;

  function setStatus(message, kind = "info") {
    let el = document.getElementById("sharedStorageStatus");
    if (!el) {
      el = document.createElement("div");
      el.id = "sharedStorageStatus";
      el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:9999;max-width:min(420px,calc(100vw - 24px));padding:10px 14px;border-radius:10px;font:12px/1.4 Inter,system-ui,sans-serif;box-shadow:0 4px 16px #0002;";
      document.body.appendChild(el);
    }
    el.style.background = kind === "error" ? "#fee2e2" : kind === "success" ? "#dcfce7" : "#e0e7ff";
    el.style.color = kind === "error" ? "#991b1b" : kind === "success" ? "#166534" : "#312e81";
    el.textContent = message;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing?.dataset.loaded === "true") return resolve();
      const script = existing || document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      if (!existing) document.head.appendChild(script);
    });
  }

  function getLocalData() {
    const result = {};
    for (const key of LOCAL_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) result[key] = raw;
    }
    return result;
  }

  function applyCloudData(data) {
    applyingCloud = true;
    try {
      for (const key of LOCAL_KEYS) {
        if (typeof data[key] === "string") localStorage.setItem(key, data[key]);
        else localStorage.removeItem(key);
      }
      if (typeof window.updateUI === "function") window.updateUI();
    } finally {
      applyingCloud = false;
    }
  }

  function isConfigured() {
    const c = window.FINANZAS_FIREBASE_CONFIG;
    return c && c.apiKey && c.projectId && c.appId &&
      !String(c.apiKey).startsWith("REEMPLAZAR") &&
      !String(c.projectId).startsWith("REEMPLAZAR") &&
      !String(c.appId).startsWith("REEMPLAZAR");
  }

  function addGoogleSignInButton() {
    const authButton = document.getElementById("authBtn");
    if (!authButton || document.getElementById("googleEditorAuthBtn")) return;
    const button = document.createElement("button");
    button.id = "googleEditorAuthBtn";
    button.type = "button";
    button.className = authButton.className;
    button.textContent = "Conectar cuenta Google para guardar";
    button.title = "Solo la cuenta autorizada puede sincronizar cambios compartidos";
    button.addEventListener("click", async () => {
      try {
        await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      } catch (error) {
        console.error("Inicio de sesión Google:", error);
        setStatus("No se pudo iniciar sesión con Google. Revisa dominios autorizados y la configuración de Firebase.", "error");
      }
    });
    authButton.insertAdjacentElement("afterend", button);
  }

  function addSignOutButton() {
    if (document.getElementById("googleEditorSignOutBtn")) return;
    const button = document.createElement("button");
    button.id = "googleEditorSignOutBtn";
    button.type = "button";
    button.className = "bg-white/10 hover:bg-white/20 text-white border border-white/20 px-3 py-2 rounded-lg text-xs font-medium";
    button.textContent = "Desconectar Google";
    button.addEventListener("click", () => auth.signOut().catch(console.error));
    const authButton = document.getElementById("authBtn");
    authButton?.insertAdjacentElement("afterend", button);
  }

  async function writeSharedData() {
    if (!cloudReady || applyingCloud) return;
    if (!auth.currentUser) {
      setStatus("Cambios guardados solo en este dispositivo. Conecta la cuenta Google autorizada para compartirlos.");
      return;
    }
    const authorizedEmail = String(window.FINANZAS_EDITOR_EMAIL || "").toLowerCase();
    if (!authorizedEmail || auth.currentUser.email?.toLowerCase() !== authorizedEmail) {
      setStatus("Esta cuenta Google no está autorizada para modificar los datos compartidos.", "error");
      return;
    }

    if (saving) { pendingSave = true; return; }
    saving = true;
    try {
      await db.collection(COLLECTION).doc(DOCUMENT).set({
        ...getLocalData(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.currentUser.email
      }, { merge: true });
      setStatus("Datos sincronizados. Todos los visitantes verán los cambios.", "success");
    } catch (error) {
      console.error("Error guardando en Firestore:", error);
      setStatus("No se pudieron sincronizar los datos. Revisa la conexión y las reglas de Firestore.", "error");
    } finally {
      saving = false;
      if (pendingSave) { pendingSave = false; writeSharedData(); }
    }
  }

  async function initialize() {
    if (!isConfigured()) {
      setStatus("Falta configurar Firebase. Sigue los pasos de README para habilitar datos compartidos.", "error");
      return;
    }
    try {
      await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth-compat.js`);
      await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore-compat.js`);
      if (!firebase.apps.length) firebase.initializeApp(window.FINANZAS_FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      originalSaveState = window.saveState;
      if (typeof originalSaveState === "function") {
        window.saveState = function (...args) {
          const result = originalSaveState.apply(this, args);
          writeSharedData();
          return result;
        };
      }
      addGoogleSignInButton();
      cloudReady = true;

      // La nube es la fuente compartida: al cargar, no se suben automáticamente
      // los datos locales de un visitante ni se sobreescribe la copia central.
      const doc = await db.collection(COLLECTION).doc(DOCUMENT).get();
      if (doc.exists) {
        applyCloudData(doc.data());
        setStatus("Datos compartidos cargados.", "success");
      } else {
        setStatus("Aún no hay datos compartidos. Inicia sesión con Google y guarda un cambio para crear el archivo central.");
      }

      db.collection(COLLECTION).doc(DOCUMENT).onSnapshot(snapshot => {
        if (snapshot.exists) {
          applyCloudData(snapshot.data());
          setStatus("Datos compartidos actualizados.", "success");
        }
      }, error => {
        console.error("Error leyendo Firestore:", error);
        setStatus("No se pueden leer los datos compartidos. Revisa las reglas públicas de lectura.", "error");
      });

      auth.onAuthStateChanged(user => {
        document.getElementById("googleEditorAuthBtn")?.classList.toggle("hidden", !!user);
        if (user) {
          addSignOutButton();
          setStatus(`Google conectado: ${user.email || "cuenta"}. ${user.email?.toLowerCase() === String(window.FINANZAS_EDITOR_EMAIL || "").toLowerCase() ? "Puedes sincronizar cambios." : "Esta cuenta no tiene permiso de edición."}`, user.email?.toLowerCase() === String(window.FINANZAS_EDITOR_EMAIL || "").toLowerCase() ? "success" : "error");
        } else {
          document.getElementById("googleEditorSignOutBtn")?.remove();
        }
      });
    } catch (error) {
      console.error("No se pudo iniciar el almacenamiento compartido:", error);
      setStatus("No se pudo conectar con Firebase. Verifica la configuración y las reglas.", "error");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
