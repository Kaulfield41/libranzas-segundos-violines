# Configuración de Firebase

## Paso 1 — Crear el proyecto Firebase

1. Ve a https://console.firebase.google.com
2. Haz clic en "Añadir proyecto"
3. Nombre: `libranzas-orquesta` (o el que quieras)
4. Desactiva Google Analytics (no lo necesitas)
5. Clic en "Crear proyecto"

## Paso 2 — Activar Authentication

1. En el menú izquierdo: Build → Authentication
2. Clic en "Empezar"
3. En la pestaña "Sign-in method", activa **Email/contraseña**
4. Guarda

## Paso 3 — Crear la base de datos Firestore

1. En el menú izquierdo: Build → Firestore Database
2. Clic en "Crear base de datos"
3. Selecciona **modo producción**
4. Elige la región más cercana (ej: `europe-west1`)
5. Clic en "Crear"

## Paso 4 — Configurar reglas de seguridad de Firestore

En Firestore → Reglas, pega esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Solo usuarios autenticados pueden leer/escribir
    function isAuth() {
      return request.auth != null;
    }

    // Solo el admin puede escribir
    function isAdmin() {
      return isAuth() && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'admin';
    }

    // Músicos solo pueden leer sus propias libranzas
    match /libranzas/{id} {
      allow read: if isAuth() && (isAdmin() || resource.data.musicoId == request.auth.uid);
      allow write: if isAdmin();
    }

    // Solo admins escriben, todos los autenticados leen proyectos
    match /proyectos/{id} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    match /temporadas/{id} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    match /conciertos/{id} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    match /rotaciones/{id} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    match /historial/{id} {
      allow read: if isAdmin();
      allow create: if isAdmin();
    }

    match /usuarios/{uid} {
      allow read: if isAuth() && (isAdmin() || request.auth.uid == uid);
      allow write: if isAdmin();
    }
  }
}
```

## Paso 5 — Obtener la configuración

1. En Firebase Console, haz clic en el engranaje ⚙️ → "Configuración del proyecto"
2. En la sección "Tus apps", haz clic en `</>` (Web)
3. Registra la app (nombre: `libranzas-web`)
4. Copia la configuración que aparece (el objeto `firebaseConfig`)

## Paso 6 — Crear el fichero .env

En la carpeta del proyecto, copia `.env.example` como `.env`:

```bash
cp .env.example .env
```

Y pega los valores de tu firebaseConfig:

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=libranzas-orquesta.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=libranzas-orquesta
VITE_FIREBASE_STORAGE_BUCKET=libranzas-orquesta.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Paso 7 — Crear el primer usuario admin

Ejecuta la app en local:

```bash
npm run dev
```

Luego, en Firebase Console → Authentication → Users, añade manualmente el primer usuario (el tuyo, con tu email de empresa).

Después ve a Firestore → usuarios → Añadir documento:
- ID del documento: el UID que aparece en Authentication
- Campos:
  - `nombre`: tu nombre
  - `apellidos`: tus apellidos
  - `email`: tu email
  - `puesto`: `solista` (o el que corresponda)
  - `rol`: `admin`
  - `activo`: `true`

A partir de ahí, el resto de músicos los creas desde la app.

## Paso 8 — Desplegar (cuando esté listo)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

La app quedará en `https://tu-proyecto.web.app`
