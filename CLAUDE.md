# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # desarrollo local (Vite)
npm run build      # compilar para producción
npm run lint       # ESLint
firebase deploy --only hosting   # desplegar
```

No hay tests automatizados.

## Stack

- React 19 + Vite 8 + Tailwind CSS v4
- Firebase (Auth + Firestore + Hosting)
- react-router-dom v7
- PWA via vite-plugin-pwa (`registerType: 'autoUpdate'`)
- date-fns con locale `es`

## Arquitectura

### Rutas y roles

Hay dos roles: `admin` y `musico` (más `observador`, que solo puede ver). El routing está en `src/App.jsx` con dos layouts separados:

- `/admin/*` → `AdminLayout` (solo admin). Nav inferior de 7 pestañas.
- `/musico/*` → `MusicoLayout` (músicos y observadores). Nav inferior de 2 pestañas.
- `RutaProtegida` redirige a admin fuera de `/admin` → `/admin`, y a no-admins fuera de `/musico` → `/musico`.

El usuario autenticado (con todos los campos de Firestore) vive en `AuthContext`. `cargando` solo se pone en false después de cargar el documento de Firestore, nunca antes.

### Motor de rotación (`src/services/rotacion.js`)

Es el núcleo de la lógica de negocio. Hay **3 colas independientes** por temporada: `proyecto`, `parte`, `obra`. Cada una es un documento en la colección `rotaciones` con el ID `{temporadaId}_{tipo}`.

Estructura del documento de rotación:
```js
{
  cola: [uid, uid, ...],      // orden fijo
  posicionActual: number,     // puntero circular
  pendientes: [uid, ...],     // tienen prioridad en la próxima asignación
  deudas: [{ acreedor, deudor }]  // intercambios pendientes de saldar
}
```

Flujo de asignación:
1. `calcularLibranzas()` — calcula quién libra según la cola, pendientes, intercambios y restricciones de puestos. Devuelve `{ asignados, pendientesNuevos, deudasNuevas, deudasResueltas }`.
2. `confirmarAsignacion()` — avanza `posicionActual`, actualiza `pendientes` y `deudas` en Firestore.

**Reglas de puestos de responsabilidad** (solista / ayuda_solista): siempre deben quedar tocando mínimo 2 responsables y mínimo 1 solista. Si no se puede, el músico queda como pendiente.

**Pendientes por coincidencia**: cuando alguien libra por `proyecto`, debe quedar pendiente en las colas de `parte`/`obra`. Esto se pasa como `uidsYaLibrando` en cada sección al llamar a `crearLibranzasLote`, que lo fusiona con `uidsPermiso`.

**Permisos/bajas**: se pasan como `uidsPermiso` a `confirmarAsignacion`. Cuando el puntero cruza la posición de un músico de baja, queda como pendiente.

**Intercambios**: A cede turno a B → se guarda deuda `{acreedor: A, deudor: B}`. La próxima vez que toque a B, libra A en su lugar y la deuda se salda.

### Creación de proyectos (3 pasos)

`NuevoProyecto.jsx` y `EditarProyecto.jsx` siguen el mismo flujo de 3 pasos:
1. Datos básicos + permisos/bajas + intercambios
2. Estructura del concierto (partes y obras)
3. Confirmar libranzas calculadas → guardar

`calcular()` llama a `calcularLibranzas` para cada sección (proyecto completo → partes → obras), pasando `yaLibrando` acumulado para evitar asignar a alguien que ya libra en un nivel superior.

### Colecciones Firestore

- `usuarios` — músicos y admin. Campos relevantes: `rol` (admin/musico/observador), `puesto` (normal/solista/ayuda_solista), `nombre`, `apellidos`.
- `temporadas` — solo una activa a la vez (`activa: true`).
- `proyectos` — con `temporadaId`, `permisosBajas`, `intercambios`.
- `libranzas` — con `tipo` (proyecto/parte/obra), `musicoId`, `proyectoId`, `parteNumero`, `obraTitulo`.
- `rotaciones` — ID compuesto: `{temporadaId}_{tipo}`.
- `historial` — log de todas las acciones admin.
- `conciertos` — estructura de partes y obras, vinculado a un proyecto.

### Firebase Auth

Se usan **dos instancias** de Firebase Auth (`auth` y `authSecundaria`) para que el admin pueda crear usuarios sin cerrar su propia sesión. `authSecundaria` solo se usa en `src/pages/admin/Musicos.jsx`.

### Variables de entorno

Todas las claves de Firebase van en `.env` (no commitear). Ver `.env.example` para las variables necesarias (`VITE_FIREBASE_*`).
