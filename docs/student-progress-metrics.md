# Metricas de progreso pedagogico

## Objetivo

Definir un modelo unico para medir avance real por alumno y reutilizarlo en backend y frontend.

## Fuentes de datos

- `Assignment`: estado global por actividad asignada.
- `AssignmentStepProgress`: pasos completados correctamente por nivel y ejercicio.
- `GameResult`: intentos, aciertos y tiempos de respuesta.

## Metricas por asignacion

- `totalSteps`: total teorico de pasos de la actividad.
  Formula: `objetos * 9`
  Detalle: L1 tiene 1 ejercicio (`show`) y L2/L3 tienen 4 ejercicios cada uno.
- `completedSteps`: numero de filas en `AssignmentStepProgress` para la asignacion.
- `percent`: `round(completedSteps / totalSteps * 100)`.
- `phaseLabel`: fase actual legible para especialista o cliente.

## Metricas por alumno

- `assignmentStats.total`: actividades asignadas al alumno.
- `assignmentStats.started`: actividades con `startedAt`.
- `assignmentStats.completed`: actividades con `completedAt`.
- `assignmentStats.active`: actividades activas (`isActive`).
- `stepStats.total`: suma de `totalSteps` de todas las asignaciones.
- `stepStats.completed`: suma de `completedSteps` de todas las asignaciones.
- `stepStats.percent`: `round(stepStats.completed / stepStats.total * 100)`.
- `responseStats.correct`: intentos correctos en `GameResult`.
- `responseStats.incorrect`: intentos incorrectos en `GameResult`.
- `responseStats.total`: suma de correctos e incorrectos.
- `responseStats.accuracyPercent`: `round(correct / total * 100)` cuando hay intentos.
- `responseStats.averageTimeMs`: media de `timeMs` con valor valido.
- `activity.lastActivityAt`: fecha mas reciente entre `progressUpdatedAt`, `completedAt`, `startedAt`, `assignedAt`, resultados y pasos completados.
- `activity.latestActivityTitle`: titulo de la asignacion con actividad mas reciente.
- `activity.currentPhaseLabel`: fase legible de la asignacion mas recientemente tocada.

## Reglas de interpretacion

- `Sin actividades`: alumno sin asignaciones.
- `Pendiente de empezar`: tiene actividades pero sin actividad registrada.
- `Sin actividad reciente`: tiene asignaciones en curso pero la ultima actividad supera 21 dias.
- `Necesita apoyo`: tiene al menos 6 intentos y precision menor del 60%.
- `Buen avance`: progreso >= 80% y precision >= 70%, o sin precision disponible.
- `En progreso`: resto de casos.

## Ventanas temporales recomendadas

- 7 dias: actividad reciente.
- 30 dias: seguimiento operativo semanal/mensual.
- 90 dias: tendencia para informes.

## Contrato del endpoint agregado

Ruta prevista:

- `GET /api/specialists/me/student-progress`

Respuesta:

- `specialist`: datos minimos del especialista analizado.
- `summary`: resumen agregado del conjunto de alumnos.
- `students`: listado ordenado de alumnos con sus metricas y estado.

## Consumo en frontend

- El dashboard del especialista debe mostrar un panel de resumen con alumnos prioritarios.
- El detalle profundo por alumno puede reutilizar la modal de actividades ya existente.