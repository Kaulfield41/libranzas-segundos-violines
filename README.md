# App Libranzas

Aplicación web PWA para gestionar las **libranzas** (turnos de descanso) de los músicos de una orquesta sinfónica. Automatiza la rotación equitativa de quién libra en cada proyecto, parte u obra de un concierto, respetando reglas de puestos de responsabilidad, permisos, bajas e intercambios entre músicos.

Desarrollada en el marco de una prueba de programación con [Claude Code](https://claude.ai/code), a partir de una necesidad presente y probablemente futura de la sección de segundos violines.

## ¿Qué problema resuelve?

En una orquesta, no todos los músicos tocan en todos los conciertos. Hay que distribuir los descansos de forma justa y ordenada, teniendo en cuenta:

- Que siempre quede un mínimo de solistas y ayudas de solista tocando.
- Que los músicos con permiso o baja no pierdan su turno en la cola.
- Que los intercambios entre músicos (A cede su turno a B) queden registrados y se salden automáticamente.

## Roles

| Rol | Acceso |
|---|---|
| `admin` | Gestión completa: músicos, temporadas, proyectos, rotaciones |
| `musico` | Consulta sus propias libranzas |
| `observador` | Solo lectura |

## Stack

- React 19 + Vite + Tailwind CSS v4
- Firebase (Auth, Firestore, Hosting)
- react-router-dom v7
- PWA con actualización automática (vite-plugin-pwa)
- date-fns con locale `es`

## Desarrollo local

```bash
cp .env.example .env   # añadir claves de Firebase
npm install
npm run dev
```
