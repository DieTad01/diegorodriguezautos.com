# Guía del panel de inventario: diegorodriguezautos.com

**Para:** Diego Rodríguez, asesor de ventas BYD | Chevrolet

Con esta guía agregas autos a tu página, subes sus fotos y cambias precio o estado desde tu celular o tu computadora. No necesitas saber nada técnico.

---

## 1. Tu acceso

| Qué | Cuál |
|---|---|
| **Dirección del panel** | **https://diegorodriguezautos.com/admin** |
| **Usuario** | El que te dio tu desarrollador (por ejemplo `diego.rodriguez`) |
| **Contraseña** | La **temporal** que te dio tu desarrollador. **Cámbiala el primer día** (paso 2) |

- Revisa que la dirección empiece con **https://** y que el navegador muestre el **candado**. Sin eso el panel no funciona.
- **En el celular:** abre la dirección en Chrome o Safari y usa **"Agregar a pantalla de inicio"**. El panel queda como una app.

![Entrar al panel](img/admin-login.png)

## 2. Cambia tu contraseña el primer día

1. Entra con tu usuario y la contraseña temporal.
2. Arriba dice **"Entraste como …"**. Ahí toca **Cambiar mi contraseña**.
3. Escribe la contraseña **actual** (la temporal) y luego tu contraseña **nueva** dos veces.
4. Toca **Guardar contraseña**.

![Cambiar mi contraseña](img/admin-contrasena.png)

Tu contraseña nueva:

- Debe tener **mínimo 12 caracteres**. Lo más fácil y seguro: **cuatro palabras al azar** separadas por guiones, que solo tú sepas (no uses ejemplos de internet ni de esta guía).
- No debe incluir tu nombre de usuario.
- No la uses en ningún otro lado (correo, banco, redes).

Desde ese momento **solo tú la conoces**: nadie la puede ver, ni tu desarrollador.

## 3. Agregar un auto

```
 📸 Fotos  →  ☁️ Google Drive  →  🔗 Copiar links  →  🛠️ Pegarlos en el panel  →  ✅ Aparece en tu página
```

### 3.1 Toma las fotos

- Con el celular **acostado** (horizontal), de día y con el auto limpio.
- **La primera foto es la portada:** frente en diagonal. Después: lateral, trasera, tablero, asientos, cajuela, rines, motor y el odómetro.
- Que no salgan placas, documentos ni personas.

### 3.2 Súbelas a Google Drive

**Una sola vez:** en Drive crea una carpeta llamada **Inventario** y compártela:

1. Mantén presionada la carpeta (o clic derecho) → **Compartir**.
2. En *Acceso general* elige **"Cualquier persona con el enlace"**, como **Lector**.

**Por cada auto:** dentro de *Inventario* crea una carpeta con su nombre (por ejemplo `Chevrolet Aveo 2019 rojo`) y sube ahí las fotos: botón **+** → **Subir**.

### 3.3 Copia el link de cada foto

En la app de Drive: **⋮** junto a la foto → **Copiar vínculo**.

- Copia el link de **cada foto**, no el de la carpeta.
- El de una foto lleva `/file/d/`. El de una carpeta lleva `/folders/` y **no funciona**.

### 3.4 Captúralo en el panel

1. Toca **+ Agregar vehículo**.
2. Llena los datos:

   | Campo | Ejemplo | Cuidado |
   |---|---|---|
   | Marca * | `Chevrolet` | |
   | Modelo * | `Aveo` | |
   | Año * | `2019` | |
   | Versión | `LT` | Llénala siempre: así buscan en Google |
   | Precio * | `169000` | **Sin** signo de pesos ni comas |
   | Kilometraje * | `64000` | Sin comas. `0` si es nuevo |
   | Color | `Rojo` | |
   | Descripción | `Único dueño, servicios de agencia. Acepto tu auto a cuenta.` | Lo que hace atractivo al auto |

3. En **Imágenes** pega los links, **uno por renglón**. Puedes poner hasta 15. El primero es la portada.
4. Toca **Previsualizar imágenes**: todas deben verse.
5. Toca **Guardar**.

| En el celular: lista de autos | En el celular: pegar fotos |
|---|---|
| ![Lista](img/admin-celular-lista.png) | ![Fotos](img/admin-celular-fotos.png) |

Listo: el auto aparece primero en **https://diegorodriguezautos.com**. Para compartirlo por WhatsApp, abre el auto en tu página → **Ver ficha completa** → comparte esa dirección. La vista previa muestra la foto, el precio y el nombre.

## 4. Cambiar precio, estado o fotos

Busca el auto en la lista → **Editar** → cambia lo necesario → **Guardar**.

| Quiero… | Hago… |
|---|---|
| Bajar o subir el precio | Editar → *Precio* → Guardar |
| Marcarlo **apartado** | Editar → *Estado*: **Apartado**. Sigue visible con la etiqueta "Apartado" |
| Marcarlo **vendido** | Editar → *Estado*: **Vendido**. Desaparece de la página y queda en tu panel como historial |
| Agregar una foto | Súbela a Drive → copia su link → pégalo en un renglón nuevo en *Imágenes* |
| Cambiar la portada | Mueve ese link al **primer renglón** |
| Quitar una foto | Borra su renglón (en tu Drive sigue guardada) |

**Mejor marca un auto como Vendido que borrarlo.** Usa **Borrar** solo si lo capturaste por error.

## 5. Cuida tu acceso

- **No compartas tu usuario ni tu contraseña.** Si alguien más va a ayudarte con el inventario, pide a tu desarrollador que le cree **su propia cuenta**.
- En una computadora que no es tuya, toca **Cerrar sesión** al terminar.
- La sesión se cierra sola a las **8 horas**.
- Si te equivocas **5 veces** de contraseña, el panel se bloquea **15 minutos**. Es una protección contra quien intente adivinarla.
- **¿Crees que alguien vio tu contraseña?** Cámbiala en **Cambiar mi contraseña**. Tus otros dispositivos quedan fuera al instante.
- **¿La olvidaste o perdiste el celular?** Avisa a tu desarrollador. Él no puede ver tu contraseña, pero puede cerrar tus sesiones y darte una temporal nueva.

## 6. Si algo no sale

| Ves… | Solución |
|---|---|
| "Usuario o contraseña incorrectos" | Revisa mayúsculas y minúsculas. Si no la recuerdas, avisa a tu desarrollador |
| "Demasiados intentos" | Espera 15 minutos |
| "No se pudo cargar. ¿Está compartida…?" | La foto no es pública: comparte la carpeta *Inventario* como "Cualquier persona con el enlace" (paso 3.2) |
| "El enlace es una carpeta de Drive…" | Copiaste el link de la carpeta: copia el de **cada foto** |
| "precio debe ser un número…" | Escribe solo números: `169000` |
| El panel te regresa a "Entrar" | Pasaron 8 horas o cambiaste tu contraseña en otro dispositivo: vuelve a entrar |
| La foto sale recortada | Es vertical: toma las fotos con el celular acostado |
| Una foto que se veía ya no se ve | La borraste o moviste en Drive: no borres de Drive fotos de autos publicados |

**Tu desarrollador:** ____________________ · Tel.: ____________________
