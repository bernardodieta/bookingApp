# Plan: Redesign 100% del Frontend — system-design.md

## Context

El frontend actual usa un design system basado en azul (#2563eb), grises fríos, sombras en cards, border-radius grandes (10-14px), font-weight hasta 800, y tabs en forma de píldora. El nuevo design system (`system-design.md`) cambia a teal verde (#2EBF8F), grises cálidos, sin sombras en reposo, radios más pequeños (4-12px), peso máximo 600, tipografía Plus Jakarta Sans + Fraunces, y tabs con borde inferior.

**Alcance**: 31 archivos, ~12,700 líneas de código UI. Se ejecutará en 10 fases independientemente desplegables.

---

## Fase 0: Infraestructura de Fuentes (sin cambio visual)

**Objetivo**: Importar Plus Jakarta Sans y Fraunces. Agregar nuevos tokens CSS junto a los existentes.

**Archivos**:
- `apps/web/app/layout.tsx` — importar fuentes con `next/font/google`, aplicar `.variable` classes al `<html>`
- `apps/web/app/globals.css` — agregar bloque de nuevas CSS variables (brand, accent, neutral, radius, etc.) SIN borrar las antiguas

**Verificación**: App idéntica visualmente. Fuentes cargando en Network tab.

---

## Fase 1: Rewrite Global CSS

**Objetivo**: Reescribir `:root` y todos los estilos base. Esto cascadea ~60-70% de los cambios.

**Archivo**: `apps/web/app/globals.css` (~300 líneas cambiadas)

**Cambios clave**:
| Selector | Actual | Nuevo |
|---|---|---|
| `--bg` | `#f6f8fc` | `#F8F7F5` |
| `--primary` | `#2563eb` | `#2EBF8F` |
| `--border` | `#dbe3ef` | `#D8D5CF` |
| `--text` | `#0f172a` | `#1A1917` |
| `--text-muted` | `#475569` | `#5E5C55` |
| `--shadow-sm` | sombra | `none` |
| `body` background | radial-gradient azul | `var(--bg)` sólido |
| `body` font-family | Inter | `var(--font-ui)` |
| Borders | `1px` | `1.5px` |
| Input/button radius | `10px` | `6px` |
| `.panel` | radius 14px, shadow | radius 8px, sin shadow, padding 20px |
| `.tab-btn` | píldora (radius 999) | borde inferior 2px |
| `.sidebar-item.active` | azul | teal |
| `.stat-card .stat-value` | weight 800 | weight 600 |
| `.skeleton` | grises fríos | grises cálidos |

---

## Fase 2: Landing + Login + Plan Request Modal

**Archivos**:
- `apps/web/app/page.tsx` — landing page
- `apps/web/app/login/page.tsx` — login
- `apps/web/app/components/plan-request-form.tsx` — modal

**Cambios**: fontWeight 700/800→600, borderRadius 999→4 (badges), colores azules→teal, background gradient→sólido, boxShadow→none

---

## Fase 3: Dashboard Shell + Overview + Notice + Wizard

**Archivos**:
- `apps/web/app/dashboard/dashboard-page-client.tsx` — sidebar, toast, shell (~líneas 1788-1900)
- `apps/web/app/dashboard/components/overview-section.tsx` — stats, bookings, badges
- `apps/web/app/dashboard/components/notice.tsx` — alertas
- `apps/web/app/dashboard/components/quick-setup-wizard.tsx` — wizard de setup

**Cambios**: brandPrimary fallback→#2EBF8F, STATUS_META colores→nuevos, statusBadge radius 999→4, fontWeight→600, toast radius→8

---

## Fase 4: Dashboard Grupo A (Agenda, Reporte, Pagos)

**Archivos**:
- `apps/web/app/dashboard/components/agenda-section.tsx`
- `apps/web/app/dashboard/components/reporte-section.tsx`
- `apps/web/app/dashboard/components/payments-section.tsx`

**Cambios**: Mismos patrones — badges, colores, pesos, radios.

---

## Fase 5: Dashboard Grupo B (Operations, Staff, Settings, Integrations, Audit)

**Archivos**:
- `apps/web/app/dashboard/components/operations-section.tsx`
- `apps/web/app/dashboard/components/staff-management-section.tsx`
- `apps/web/app/dashboard/components/settings-section.tsx`
- `apps/web/app/dashboard/components/integrations-section.tsx`
- `apps/web/app/dashboard/components/audit-section.tsx`

---

## Fase 6: Staff Dashboard

**Archivos**:
- `apps/web/app/staff-dashboard/staff-dashboard-client.tsx`
- `apps/web/app/staff-dashboard/components/staff-bookings-section.tsx`
- `apps/web/app/staff-dashboard/components/staff-calendar-section.tsx`
- `apps/web/app/staff-dashboard/components/staff-profile-section.tsx`

**Cambios**: Tab bar→borde inferior, badges, colores, avatares cuadrados (6px).

---

## Fase 7: Portal Público + Portal Cliente

**Archivos**:
- `apps/web/app/public/[slug]/page.tsx` (1025 líneas)
- `apps/web/app/public/[slug]/mis-citas/page.tsx` (1724 líneas)

**Nota**: Estos son los archivos más grandes y con más inline styles. mis-citas tiene ~17 backgrounds hardcodeados, 5+ badge radii, 8+ font weights.

---

## Fase 8: Admin Panel

**Archivo**: `apps/web/app/admin/page.tsx`

**Cambios**: badges, colores, pesos, radios.

---

## Fase 9: Limpieza Final

**Acciones**:
1. Eliminar variables CSS antiguas de globals.css
2. Búsqueda global de valores residuales: `#2563eb`, `#1d4ed8`, `fontWeight: 700`, `borderRadius: 999`, etc.
3. Aplicar Fraunces a elementos display (fechas grandes, cifras de stats, títulos hero)
4. Auditoría de espaciado: valores no múltiplos de 4px → alinear
5. Test responsive en 1024px y 768px

---

## Mapa de Reemplazos Mecánicos (aplica en fases 2-8)

| Patrón inline | Reemplazo |
|---|---|
| `fontWeight: 800` | `600` |
| `fontWeight: 700` | `600` |
| `borderRadius: 999` / `'999px'` | `4` (badges) |
| `borderRadius: 14` | `8` (cards) |
| `borderRadius: 12` | `8` (cards) |
| `borderRadius: 10` (inline) | `6` (inputs) o `8` (cards) |
| `borderRadius: '50%'` | `6` (avatares cuadrados) |
| `#2563eb` | `#2EBF8F` |
| `#1d4ed8` | `#1A8E69` |
| `#eaf1ff` | `rgba(46,191,143,0.1)` |
| `#c7d8ff` | `rgba(46,191,143,0.2)` |
| `#eff6ff` | `#EFF8F5` (brand-50) |
| `#f6f8fc` | `#F8F7F5` (neutral-50) |
| `#f1f5f9` | `#EEECE8` (neutral-100) |
| `#e2e8f0` | `#D8D5CF` (neutral-200) |
| `#64748b` | `#9E9B93` (neutral-400) |
| `#0f172a` | `#1A1917` (neutral-900) |
| `#374151` | `#5E5C55` (neutral-600) |
| `boxShadow` en cards/botones | `'none'` o eliminar |
| `border: '1px solid'` (inline) | `'1.5px solid'` |

---

## Verificación por Fase

| Fase | Qué verificar |
|---|---|
| 0 | `npm run build` exitoso, fuentes en Network tab |
| 1 | Navegar todas las páginas — teal primario, grises cálidos, radios menores |
| 2 | Landing, login, modal de plan — diseño correcto |
| 3 | Dashboard: sidebar teal, overview stats/badges, toast, wizard |
| 4 | Tabs Agenda, Reporte, Pagos — consistentes |
| 5 | Tabs Operations, Staff, Settings, Integrations, Audit — consistentes |
| 6 | Login como staff — tabs, bookings, calendar, profile |
| 7 | Visitar `/public/{slug}` y `/public/{slug}/mis-citas` — flujo completo |
| 8 | Panel admin — tenants, audit, plan requests |
| 9 | Grep por valores residuales = 0 resultados. Mobile responsive OK |
