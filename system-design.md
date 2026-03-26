# Apoint — Sistema de Diseño
> Versión 2.0 · Clean & Friendly · Orientado a consultorios médicos

---

## 1. Principios de diseño

| Principio | Descripción |
|-----------|-------------|
| **Limpio** | Sin sombras innecesarias. La jerarquía se define con bordes y color de fondo, no con elevación. |
| **Friendly** | Tipografía cálida, neutrales con tono orgánico, lenguaje cercano al usuario final (médicos y recepcionistas). |
| **Consistente** | Todos los componentes comparten la misma escala de espaciado, radio y tokens de color. |
| **Accesible** | Contraste mínimo AA en todos los textos sobre fondo. Estados de error, warning y success claramente diferenciados. |

---

## 2. Tipografía

### Familias

| Rol | Familia | Uso |
|-----|---------|-----|
| **UI / Cuerpo** | Plus Jakarta Sans | Todos los textos de interfaz, labels, botones, inputs, metadata |
| **Display / Destaque** | Fraunces (serif) | Fechas grandes, cifras clave, titulares de sección |

### Escala tipográfica

| Token | Familia | Tamaño | Peso | Line-height | Tracking | Uso |
|-------|---------|--------|------|-------------|----------|-----|
| `text-display` | Fraunces | 36px | 600 | 1.1 | -0.02em | Fechas destacadas, hero numbers |
| `text-h1` | Plus Jakarta Sans | 28px | 600 | 1.2 | — | Título de página |
| `text-h2` | Plus Jakarta Sans | 22px | 600 | 1.3 | — | Título de sección |
| `text-h3` | Plus Jakarta Sans | 17px | 600 | 1.4 | — | Nombre de doctor, subtítulo |
| `text-body` | Plus Jakarta Sans | 15px | 400 | 1.6 | — | Descripción, notas, contenido general |
| `text-small` | Plus Jakarta Sans | 13px | 400 | 1.5 | — | Hora, dirección, teléfono, metadata |
| `text-label` | Plus Jakarta Sans | 12px | 600 | 1.4 | +0.06em | Etiquetas, eyebrow, uppercase caps |

### Reglas

- Nunca usar menos de **12px** en producción
- `text-label` siempre en **UPPERCASE**
- Usar **Fraunces** exclusivamente para cifras o fechas que necesiten destacar visualmente
- Peso máximo permitido: **600** — no usar 700 ni 800

---

## 3. Paleta de colores

### Brand — Teal Verde (color primario)

| Token | Hex | Uso |
|-------|-----|-----|
| `brand-50` | `#EFF8F5` | Fondos de card destacada, hover de ghost button |
| `brand-100` | `#C8EDE1` | Bordes de card brand, fondos de badge success |
| `brand-200` | `#8DD5BE` | Separadores decorativos, ilustraciones |
| `brand-400` | `#2EBF8F` | **Color primario** — botones, links activos, focus ring |
| `brand-600` | `#1A8E69` | Hover de botón primario, texto sobre fondo brand |
| `brand-800` | `#0D5C44` | Texto en fondos brand-50 y brand-100 |
| `brand-900` | `#073D2D` | Texto oscuro en contextos de alto contraste |

### Accent — Azul Confianza (color secundario)

| Token | Hex | Uso |
|-------|-----|-----|
| `accent-50` | `#EEF4FE` | Fondo de badge info, fondo de alerta info |
| `accent-100` | `#C5D9FC` | Borde de alerta info, avatar placeholder |
| `accent-400` | `#4F82E8` | **Color secundario** — botones de acción secundaria, links |
| `accent-600` | `#2D5EC8` | Hover de accent, texto sobre fondo accent |
| `accent-800` | `#1A3A87` | Texto en fondos accent-50 y accent-100 |

### Neutrales — Warm Gray (no grises fríos)

| Token | Hex | Uso |
|-------|-----|-----|
| `neutral-50` | `#F8F7F5` | Fondo de página, fondo de input deshabilitado |
| `neutral-100` | `#EEECE8` | Fondo de row hover, separadores suaves |
| `neutral-200` | `#D8D5CF` | **Borde estándar** de inputs y cards |
| `neutral-400` | `#9E9B93` | Texto placeholder, iconos inactivos, metadata |
| `neutral-600` | `#5E5C55` | Texto secundario, labels de input |
| `neutral-800` | `#2C2B27` | Texto de cuerpo principal |
| `neutral-900` | `#1A1917` | Texto de encabezados |

### Semánticos

| Token | Hex | Uso |
|-------|-----|-----|
| `success-100` | `#EFF8F5` | Fondo de badge / alerta success |
| `success-400` | `#2EBF8F` | Icono y borde de estado success (= brand-400) |
| `warning-100` | `#FAEEDA` | Fondo de badge / alerta warning |
| `warning-400` | `#BA7517` | Texto e icono de estado warning |
| `error-100` | `#FCEBEB` | Fondo de badge / alerta error, fondo input error |
| `error-400` | `#E24B4A` | Borde de input con error, texto de error |

---

## 4. Espaciado

Base: **4px**. Todos los valores son múltiplos exactos.

| Token | Valor | Uso típico |
|-------|-------|------------|
| `space-xs` | 4px | Gap entre icono y texto en badge |
| `space-sm` | 8px | Padding interno de badge, gap entre botones pequeños |
| `space-md` | 12px | Gap entre elementos de formulario |
| `space-base` | 16px | Gap estándar entre cards, padding horizontal de inputs |
| `space-lg` | 20px | Padding interno de cards pequeños |
| `space-xl` | 24px | Padding interno de cards estándar |
| `space-2xl` | 32px | Separación entre secciones |
| `space-3xl` | 48px | Separación entre bloques de página |
| `space-4xl` | 64px | Márgenes de layout |
| `space-5xl` | 80px | Secciones hero |

### Padding de componentes

| Componente | Padding |
|------------|---------|
| Input / Select (altura 40px) | `0 12px` |
| Botón default | `10px 20px` |
| Botón sm | `6px 14px` |
| Botón lg | `14px 28px` |
| Card estándar | `20px` (1.25rem) |
| Badge | `4px 10px` |
| Alerta | `12px 14px` |
| Tab | `8px 18px` |

---

## 5. Radio de bordes

| Token | Valor | Uso |
|-------|-------|-----|
| `radius-sm` | 4px | Botones pequeños, badges, checkboxes |
| `radius-md` | 6px | Inputs, selects, textareas, botones default, alertas |
| `radius-lg` | 8px | Cards, modales, tarjetas de cita |
| `radius-xl` | 12px | Panels grandes, hero sections, encabezado de marca |

> **Regla:** Los toggles y avatares circulares usan `border-radius: 50%` — son la única excepción fuera de la escala.

---

## 6. Sombras y elevación

La jerarquía visual se comunica **principalmente con bordes y color de fondo**, no con sombras.

| Token | Valor CSS | Cuándo usarlo |
|-------|-----------|---------------|
| `shadow-none` | ninguna | Cards estándar, inputs, layouts base |
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Card con ligera elevación, hover de card clickeable |
| `shadow-md` | `0 2px 6px rgba(0,0,0,0.06)` | Dropdowns abiertos, tooltips |
| `shadow-lg` | `0 4px 12px rgba(0,0,0,0.07)` | Modales, popovers, sidesheets |

> **Regla:** No usar sombras en cards estáticas. Solo usar `shadow-sm` o mayor cuando un elemento flota sobre el contenido.

---

## 7. Bordes

| Situación | Valor |
|-----------|-------|
| Borde estándar (card, input en reposo) | `1.5px solid #D8D5CF` (neutral-200) |
| Borde de foco (input activo) | `1.5px solid #2EBF8F` (brand-400) |
| Borde de error | `1.5px solid #E24B4A` (error-400) |
| Borde de card brand | `1.5px solid #C8EDE1` (brand-100) |
| Borde de separador suave | `1px solid #EEECE8` (neutral-100) |
| Tab activo (bottom border) | `2px solid #2EBF8F` (brand-400) |

---

## 8. Componentes

### 8.1 Botones

| Variante | Fondo | Texto | Borde | Hover |
|----------|-------|-------|-------|-------|
| `btn-primary` | brand-400 | white | — | brand-600 |
| `btn-secondary` | white | neutral-800 | 1.5px neutral-200 | border brand-400, text brand-600 |
| `btn-ghost` | transparent | brand-600 | — | bg brand-50 |
| `btn-danger` | error-100 | error-400 | — | bg error más oscuro |
| `btn-icon` | neutral-100 | neutral-600 | — | neutral-200 |

**Tamaños:**

| Tamaño | Altura | Padding | Font | Radio |
|--------|--------|---------|------|-------|
| `sm` | 30px | `6px 14px` | 13px | radius-sm (4px) |
| `default` | 40px | `10px 20px` | 14px | radius-md (6px) |
| `lg` | 52px | `14px 28px` | 16px | radius-lg (8px) |

**Reglas:**
- Font weight siempre **500**
- No usar sombra en botones
- Estado `disabled`: opacity 0.4, cursor not-allowed

---

### 8.2 Inputs

**Estructura:** `label → input → hint/error`

| Estado | Borde | Fondo | Texto |
|--------|-------|-------|-------|
| Reposo | 1.5px neutral-200 | white | neutral-800 |
| Focus | 1.5px brand-400 + ring 3px rgba(brand, 0.10) | white | neutral-800 |
| Error | 1.5px error-400 + ring 3px rgba(error, 0.12) | white | neutral-800 |
| Disabled | 1.5px neutral-200 | neutral-50 | neutral-400 |

**Especificaciones:**
- Altura: **40px**
- Padding: `0 12px` (sin icono) / `0 12px 0 36px` (con icono izquierdo)
- Font size: **14px**, family: Plus Jakarta Sans
- Radio: **radius-md (6px)**
- Label: 13px, weight 600, color neutral-600, margin-bottom 6px
- Hint: 12px, color neutral-400, margin-top 4px
- Error message: 12px, color error-400, margin-top 4px

**Tipos soportados:** `text`, `email`, `tel`, `date`, `time`, `number`, `password`, `search`

---

### 8.3 Select / Dropdown

- Mismas especificaciones que el input de texto
- Ícono de chevron: SVG inline, derecha, 12px, color neutral-400
- `appearance: none` — control visual propio

---

### 8.4 Textarea

- Padding: `10px 12px`
- Min-height: **90px**
- `resize: vertical` — nunca horizontal
- Radio: radius-md (6px)
- Mismo comportamiento de borde que input

---

### 8.5 Checkbox

- Tamaño: **18×18px**
- Radio: radius-sm (4px) — cuadrado redondeado, no circular
- Estado activo: fondo brand-400, borde brand-400, check blanco SVG
- Estado inactivo: fondo white, borde 1.5px neutral-200

---

### 8.6 Radio button

- Tamaño: **18×18px**, siempre circular (`border-radius: 50%`)
- Estado activo: borde brand-400 + punto interior 8×8px brand-400
- Estado inactivo: borde 1.5px neutral-200

---

### 8.7 Toggle

- Tamaño track: **42×24px**, `border-radius: 12px`
- Tamaño thumb: **18×18px**, circular, fondo white
- Estado ON: track brand-400, thumb a la derecha (translateX 18px)
- Estado OFF: track neutral-200, thumb a la izquierda
- Transición: `0.2s ease`

---

### 8.8 Badges / Tags

| Variante | Fondo | Texto |
|----------|-------|-------|
| `success` | brand-50 | brand-800 |
| `warning` | warning-100 | warning-400 |
| `error` | error-100 | error-400 |
| `neutral` | neutral-100 | neutral-600 |
| `accent` | accent-50 | accent-600 |

**Especificaciones:**
- Padding: `4px 10px`
- Radio: **radius-sm (4px)** — rectangular con esquinas leves, NO píldora
- Font size: **12px**, weight **500**
- Punto de estado: `6×6px`, `border-radius: 50%`, margen derecho 6px

---

### 8.9 Cards

| Variante | Fondo | Borde | Sombra |
|----------|-------|-------|--------|
| `card` (base) | white | 1.5px neutral-200 | ninguna |
| `card-elevated` | white | 1.5px neutral-200 | shadow-sm |
| `card-brand` | brand-50 | 1.5px brand-100 | ninguna |

**Especificaciones:**
- Radio: **radius-lg (8px)**
- Padding: **20px** (1.25rem)
- Gap entre cards en grid: **16px**

---

### 8.10 Tarjeta de cita (componente clave)

Estructura:
```
[ fecha ] [ info: nombre / meta / badge ] [ avatar ] [ menú ]
```

- Contenedor: card base (white, borde neutral-200, radius-lg)
- Bloque fecha: fondo brand-50, borde brand-100, radio radius-md
  - Día: Fraunces 26px 600, color brand-600
  - Mes: 11px 600 uppercase +0.06em, color brand-400
- Nombre: 15px 600 neutral-900
- Meta (hora · doctor · especialidad): 13px neutral-400
- Badge de estado: margin-top 6px
- Avatar: 36×36px, radio radius-md (cuadrado redondeado), fondo accent-100
- Botón menú (⋯): btn-icon, fondo neutral-50

---

### 8.11 Alertas

| Variante | Fondo | Borde | Texto |
|----------|-------|-------|-------|
| `success` | brand-50 | brand-100 | brand-800 |
| `warning` | warning-100 | #FAC775 | warning-400 |
| `error` | error-100 | #F7C1C1 | error-400 |
| `info` | accent-50 | accent-100 | accent-800 |

**Especificaciones:**
- Padding: `12px 14px`
- Radio: radius-md (6px)
- Borde: 1px solid (más sutil que los cards)
- Ícono: 16px, alineado top con el texto, margen derecho 10px
- Font size: **14px**

---

### 8.12 Tabs de navegación

- Fondo: transparent (sin fondo de tab)
- Borde inferior del contenedor: `1.5px solid neutral-100`
- Tab inactivo: 14px 500, color neutral-400
- Tab activo: color brand-600, borde inferior `2px solid brand-400`
- Padding por tab: `8px 18px`
- Hover inactivo: color neutral-800

---

### 8.13 Avatar

- Tamaño estándar: **36×36px**
- Radio: **radius-md (6px)** — cuadrado redondeado (no circular)
- Iniciales: 13px 600
- Colores por defecto: fondo accent-100, texto accent-600
- Neutral: fondo neutral-100, texto neutral-400

---

## 9. Tokens CSS — Referencia rápida

```css
:root {
  /* Brand */
  --brand-50:   #EFF8F5;
  --brand-100:  #C8EDE1;
  --brand-200:  #8DD5BE;
  --brand-400:  #2EBF8F;   /* primario */
  --brand-600:  #1A8E69;
  --brand-800:  #0D5C44;
  --brand-900:  #073D2D;

  /* Accent */
  --accent-50:  #EEF4FE;
  --accent-100: #C5D9FC;
  --accent-400: #4F82E8;   /* secundario */
  --accent-600: #2D5EC8;
  --accent-800: #1A3A87;

  /* Neutrales */
  --neutral-50:  #F8F7F5;
  --neutral-100: #EEECE8;
  --neutral-200: #D8D5CF;  /* borde estándar */
  --neutral-400: #9E9B93;
  --neutral-600: #5E5C55;
  --neutral-800: #2C2B27;  /* texto cuerpo */
  --neutral-900: #1A1917;

  /* Semánticos */
  --success-100: #EFF8F5;
  --success-400: #2EBF8F;
  --warning-100: #FAEEDA;
  --warning-400: #BA7517;
  --error-100:   #FCEBEB;
  --error-400:   #E24B4A;

  /* Radio */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  /* Sombras */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 2px 6px rgba(0,0,0,0.06);
  --shadow-lg: 0 4px 12px rgba(0,0,0,0.07);

  /* Tipografía */
  --font-ui:      'Plus Jakarta Sans', sans-serif;
  --font-display: 'Fraunces', serif;
}
```

---

## 10. Reglas globales

1. **Sin sombras en reposo.** Los cards, inputs y botones en estado normal usan solo borde. Las sombras se reservan para elementos que flotan (dropdowns, modales, tooltips).
2. **Bordes de 1.5px**, no 1px ni 2px. Excepción: separadores (`1px`) y tab activo (`2px`).
3. **Badges siempre con radio-sm (4px)**, nunca en forma de píldora completa.
4. **Avatares de usuario cuadrados redondeados** (radius-md), no circulares.
5. **Neutrales cálidos**, no usar grises fríos (#ccc, #eee, #f5f5f5 puros).
6. **Fraunces solo para display** — fechas, cifras grandes, títulos hero. Todo lo demás en Plus Jakarta Sans.
7. **Espaciado en múltiplos de 4px** — nunca valores arbitrarios como 7px, 11px, 15px.
8. **Los inputs siempre tienen label visible** — no usar solo placeholder como label.
9. **Estados de error siempre con mensaje de texto**, no solo cambio de color.
10. **Peso de texto máximo: 600** — no usar bold 700/800 en ningún componente.

---

*Apoint Design System v2.0 — Generado como parte del proceso de definición de UI para la plataforma SaaS de reservas médicas.*
