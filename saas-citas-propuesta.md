# 📅 SaaS de Gestión de Citas — Propuesta Técnica y Funcional

> Documento de referencia para el cliente — Versión 1.0

---

## 1. Visión General del Producto

Una plataforma SaaS (Software as a Service) de gestión de citas diseñada para cualquier tipo de negocio que requiera agendar reuniones o servicios: médicos, mecánicos, salones de belleza, consultores, abogados, dentistas, psicólogos, y más.

Cada negocio obtiene su propia página de reservas personalizada, accesible 24/7 para sus clientes, sin necesidad de llamadas telefónicas.

---

## 2. Funcionalidades

### 2.1 Gestión de Agenda

- Calendario visual con vistas por día, semana y mes
- Horarios de disponibilidad configurables por negocio y por empleado
- Bloqueo de días festivos, vacaciones o horarios no disponibles
- Soporte para múltiples usuarios/empleados por cuenta (ej. un taller con 3 mecánicos, cada uno con su propia agenda)
- Tiempo de buffer configurable entre citas (ej. 15 minutos de limpieza entre clientes)
- Límite máximo de reservas por día o semana

### 2.2 Reservas en Línea

- Página pública de reservas personalizable por negocio (`plataforma.com/mi-negocio`)
- Reserva disponible las 24 horas del día, los 7 días de la semana
- Flujo de reserva paso a paso: selección de servicio → empleado → horario → datos personales
- Formulario de datos del cliente configurable según las necesidades del negocio
- Lista de espera automática cuando un horario está lleno (se notifica al siguiente en lista si hay cancelación)
- Reglas de cancelación y reprogramación configurables por el negocio

### 2.3 Notificaciones Automáticas

- Confirmación inmediata por correo electrónico y/o SMS al cliente al reservar
- Recordatorios automáticos antes de la cita (configurables: 24 horas antes, 2 horas antes, etc.)
- Notificación al negocio cuando se realiza una nueva reserva, modificación o cancelación
- Notificaciones por WhatsApp Business (disponible en plan Pro y superior)

### 2.4 Gestión del Negocio

- Catálogo de servicios con nombre, duración y precio individual
- CRM básico de clientes: historial de citas, notas internas, información de contacto
- Panel de administración con vista global de todas las citas del día/semana
- Gestión de cancelaciones con política configurable (reembolso, crédito, sin devolución)
- Soporte para múltiples sedes o sucursales (plan Business)

### 2.5 Pagos en Línea

- Pago completo o depósito parcial al momento de reservar para confirmar la cita
- Integración con Stripe (global) y MercadoPago (Latinoamérica)
- Generación de notas de venta o facturas básicas
- Política de reembolso configurable por el negocio
- Historial de transacciones y pagos por cliente

### 2.6 Reportes y Analytics

- Dashboard con métricas clave: citas por período, ingresos generados, tasa de cancelaciones
- Identificación de clientes más frecuentes
- Servicios más demandados
- Análisis de horas pico para optimizar la agenda
- Exportación de reportes en formato Excel o PDF

### 2.7 Personalización por Negocio

- Logo y colores propios en la página pública de reservas
- Dominio personalizado (`citas.mi-negocio.com`) disponible en plan Business
- Mensajes personalizados en correos electrónicos y confirmaciones
- Widget embebible en el sitio web propio del negocio
- Idioma y zona horaria configurable

### 2.8 Integraciones

- **Google Calendar / Outlook**: sincronización bidireccional de citas
- **Google Meet / Zoom**: generación automática de enlace para citas virtuales
- **WhatsApp Business**: notificaciones y recordatorios por WhatsApp
- **Redes sociales**: botón de reserva directo desde Instagram y Facebook
- **Zapier**: conexión con cientos de otras herramientas sin necesidad de código

---

## 3. Modelo de Planes (SaaS)

| Característica | 🆓 Free | 🚀 Pro | 🏢 Business |
|---|---|---|---|
| Usuarios/empleados | 1 | Hasta 5 | Ilimitados |
| Citas por mes | 50 | Ilimitadas | Ilimitadas |
| Notificaciones por email | ✅ | ✅ | ✅ |
| Notificaciones SMS | ❌ | ✅ | ✅ |
| Notificaciones WhatsApp | ❌ | ✅ | ✅ |
| Pagos en línea | ❌ | ✅ | ✅ |
| CRM de clientes | Básico | Completo | Completo |
| Dominio personalizado | ❌ | ❌ | ✅ |
| Multi-sede | ❌ | ❌ | ✅ |
| Reportes y analytics | Básico | Avanzado | Avanzado + exportación |
| Soporte | Email | Prioritario | Dedicado |

---

## 4. Arquitectura del Sistema

La plataforma utiliza una arquitectura **multi-tenant** con separación clara entre frontend y backend, diseñada para escalar de forma progresiva.

```
[Cliente Final]              [Negocio — Dashboard]
       │                             │
       ▼                             ▼
 Next.js (página pública)     Next.js (panel de admin)
       │                             │
       └──────────────┬──────────────┘
                      ▼
               API REST / tRPC
             (Backend — NestJS)
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
     PostgreSQL     Redis        BullMQ
    (datos core)   (caché)    (cola de jobs)
                                   │
                         ┌─────────┴──────────┐
                         ▼                    ▼
                   Resend/SendGrid         Twilio
                      (emails)        (SMS / WhatsApp)
```

### 4.1 Estrategia Multi-Tenant

Cada negocio (tenant) comparte la misma infraestructura pero sus datos están completamente aislados mediante `tenant_id` a nivel de base de datos, garantizando privacidad y seguridad entre clientes.

---

## 5. Tecnologías

### 5.1 Frontend

| Tecnología | Rol |
|---|---|
| **Next.js 14+** | Framework principal con App Router y SSR |
| **TypeScript** | Tipado estático en todo el frontend |
| **Tailwind CSS** | Estilos y diseño responsivo |
| **Shadcn/ui** | Componentes de interfaz profesionales |
| **TanStack Query** | Gestión de datos del servidor y caché |
| **React Hook Form + Zod** | Formularios con validación robusta |
| **Zustand** | Estado global de la aplicación |

El frontend contempla dos aplicaciones dentro del mismo proyecto:
- **Dashboard del negocio**: panel de administración para gestionar citas, configuración y reportes.
- **Página pública de reservas**: interfaz que ven los clientes finales para agendar una cita.

### 5.2 Backend

| Tecnología | Rol |
|---|---|
| **NestJS (Node.js)** | Framework backend estructurado y modular |
| **TypeScript** | Tipado en todo el backend |
| **Prisma ORM** | Gestión de base de datos y migraciones |
| **PostgreSQL** | Base de datos relacional principal |
| **Redis** | Caché de disponibilidad, sesiones y rate limiting |
| **BullMQ** | Cola de trabajos asíncronos (recordatorios, emails) |
| **JWT + Refresh Tokens** | Autenticación segura |

### 5.3 Servicios Externos

| Servicio | Propósito |
|---|---|
| **Stripe** | Pagos internacionales |
| **MercadoPago** | Pagos en Latinoamérica |
| **Resend / SendGrid** | Envío de correos transaccionales |
| **Twilio** | Envío de SMS y WhatsApp |
| **Cloudflare R2 / AWS S3** | Almacenamiento de logos e imágenes |

### 5.4 Infraestructura y DevOps

| Herramienta | Propósito |
|---|---|
| **Vercel** | Deploy del frontend Next.js |
| **Railway / Render** | Deploy del backend, PostgreSQL y Redis |
| **Cloudflare** | DNS, CDN y protección DDoS |
| **GitHub Actions** | CI/CD automatizado |
| **Docker** | Contenedores para ambientes consistentes |

---

## 6. Seguridad

- HTTPS obligatorio en todos los endpoints
- Rate limiting en endpoints públicos (especialmente la página de reservas)
- Validación de datos en frontend y backend con Zod
- Aislamiento de datos por tenant con Row-Level Security en PostgreSQL
- Variables de entorno gestionadas de forma segura (nunca expuestas en el repositorio)
- Logs de auditoría para acciones sensibles (pagos, eliminación de datos)
- Cumplimiento con principios de GDPR / privacidad de datos

---

## 7. Hoja de Ruta Sugerida

### Fase 1 — MVP (2–3 meses)
- Registro y autenticación de negocios
- Configuración de servicios, empleados y horarios
- Página pública de reservas funcional
- Notificaciones por email
- Plan Free operativo

### Fase 2 — Monetización (1–2 meses)
- Integración de pagos (Stripe / MercadoPago)
- Notificaciones por SMS y WhatsApp
- CRM básico de clientes
- Lanzamiento de plan Pro

### Fase 3 — Escala (2–3 meses)
- Reportes y analytics avanzados
- Multi-sede
- Dominio personalizado
- Widget embebible
- Integraciones (Google Calendar, Zoom, Zapier)
- Lanzamiento de plan Business

---

## 8. Diferenciadores Clave

- **Lista de espera automática**: cuando se cancela una cita, el siguiente en lista recibe una notificación instantánea.
- **Reservas por WhatsApp**: el cliente puede reservar directamente desde WhatsApp sin necesidad de abrir un navegador.
- **Widget embebible**: el negocio puede integrar el sistema de reservas en su propio sitio web con una sola línea de código.
- **Multi-empleado real**: cada empleado tiene su propia agenda, disponibilidad y servicios asignados.
- **Reseñas post-cita**: los clientes pueden dejar una valoración al terminar la cita, ayudando al negocio a construir reputación.

---

*Documento preparado para presentación con cliente — Febrero 2026*
