# App Libranzas

Aplicación web PWA para gestionar las **libranzas** (turnos de descanso) de los músicos de una orquesta sinfónica. Automatiza la rotación equitativa de quién libra en cada proyecto, parte u obra de un concierto, respetando reglas de puestos de responsabilidad, permisos, bajas e intercambios entre músicos.

Desarrollada en el marco de una prueba de programación con [Claude Code](https://claude.ai/code), a partir de una necesidad presente y probablemente futura de la sección de segundos violines.

---

## ¿Qué problema resuelve?

En una orquesta, no todos los músicos tocan en todos los conciertos. Hay que distribuir los descansos de forma justa y ordenada, teniendo en cuenta:

- Que siempre quede un mínimo de solistas y ayudas de solista tocando.
- Que los músicos con permiso o baja no pierdan su turno en la cola.
- Que los intercambios entre músicos (A cede su turno a B) queden registrados y se salden automáticamente.
- Que los refuerzos externos (músicos contratados puntualmente) aumenten el número de libranzas disponibles.

---

## Roles

| Rol | Acceso |
|---|---|
| `admin` | Gestión completa: músicos, temporadas, proyectos, rotaciones |
| `musico` | Consulta las libranzas de la temporada activa |
| `observador` | Solo lectura |

---

## Vistas del administrador

### Músicos
Listado de todos los músicos de la sección. Desde aquí el admin puede crear nuevos usuarios, ver su puesto (normal / ayuda solista / solista) y acceder a su ficha.

### Temporadas
Cada temporada agrupa un conjunto de proyectos. Solo puede haber una temporada activa a la vez. Desde esta vista se pueden crear, editar, activar y eliminar temporadas (el borrado elimina en cascada todos sus proyectos, conciertos, libranzas y rotaciones).

Cada temporada muestra los proyectos que contiene con un enlace directo a cada uno.

### Proyectos
Lista de proyectos de la temporada activa. Cada proyecto muestra el nombre, las fechas y si se necesita a toda la plantilla o un número concreto de músicos.

Al crear o editar un proyecto (flujo de 3 pasos):
1. **Datos básicos**: nombre, fechas, músicos necesarios para el proyecto completo, refuerzos externos, permisos/bajas del proyecto e intercambios de turno.
2. **Estructura del concierto**: fecha y hora, partes (1 o 2), obras por parte con sus propios músicos necesarios.
3. **Confirmar libranzas**: muestra las libranzas calculadas por el motor de rotación antes de guardarlas.

### Detalle del proyecto
Muestra el resumen de libranzas asignadas (con badge diferenciado para permisos/bajas) y la lista de conciertos con su estructura de partes y obras. Desde aquí se puede acceder a la gestión completa de libranzas o editar el proyecto.

### Gestión de libranzas
Vista detallada de todas las libranzas de un proyecto, con la posibilidad de añadir o eliminar libranzas individuales.

### Rotación
Muestra el estado actual de las tres colas de rotación (proyecto, parte, obra): orden de los músicos, posición actual y pendientes.

### Historial
Registro cronológico de todas las acciones realizadas por el admin (creación de proyectos, asignación de libranzas, etc.).

---

## Vista del músico

### Libranzas
Lista de todos los proyectos de la temporada activa con las libranzas asignadas en cada uno. Muestra para cada libranza si es por proyecto completo, por parte o por obra, y distingue con un badge rojo los músicos en permiso o baja.

### Rotación
Muestra la posición de cada músico en las tres colas de rotación, para que cada uno sepa cuándo le toca librar aproximadamente.

---

## Motor de rotación

El núcleo de la lógica de negocio está en `src/services/rotacion.js`. Hay **3 colas independientes** por temporada: `proyecto`, `parte` y `obra`.

**Flujo de asignación:**
1. Se calcula cuántos músicos deben librar: `total_sección + refuerzos − músicos_necesarios`.
2. Se respetan las **reglas de puestos**: siempre deben quedar tocando al menos 2 responsables (solista + ayuda) y al menos 1 solista. Si no se puede cubrir, el músico queda como pendiente.
3. Los **pendientes** tienen prioridad en la siguiente asignación.
4. Los **intercambios** (A cede turno a B) generan una deuda que se salda automáticamente la próxima vez que toque a B.
5. Los músicos en **permiso o baja** se excluyen del cálculo pero no pierden su posición en la cola.

Cuando alguien libra por proyecto completo, queda automáticamente como pendiente en las colas de parte y obra para ese mismo proyecto, evitando que le toque librar dos veces.

---

## Stack

- React 19 + Vite + Tailwind CSS v4
- Firebase (Auth, Firestore, Hosting)
- react-router-dom v7
- PWA con actualización automática (vite-plugin-pwa)
- date-fns con locale `es`

---

## Desarrollo local

```bash
cp .env.example .env   # añadir claves de Firebase
npm install
npm run dev
```

## Despliegue

```bash
npm run build
firebase deploy --only hosting
```
