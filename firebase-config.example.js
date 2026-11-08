/*
 * Configuración pública de Firebase para la sincronización compartida.
 * Copia este archivo como firebase-config.js y reemplaza los valores desde
 * Firebase Console > Project settings > Your apps > Web app.
 * La configuración web no es un secreto; la seguridad real está en Firestore Rules.
 */
window.FINANZAS_FIREBASE_CONFIG = {
  apiKey: "REEMPLAZAR_API_KEY",
  authDomain: "REEMPLAZAR_PROJECT_ID.firebaseapp.com",
  projectId: "REEMPLAZAR_PROJECT_ID",
  appId: "REEMPLAZAR_APP_ID"
};

// Debe coincidir con el correo autorizado en firestore.rules.
window.FINANZAS_EDITOR_EMAIL = "REEMPLAZAR_CON_TU_CORREO_GOOGLE";
