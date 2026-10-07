# 3. Fotos desde Google Drive

[← Volver al índice](README.md)

Las fotos **no se suben al servidor**: se quedan en tu Google Drive y el sitio solo guarda el link. Así el VPS no se llena de imágenes y puedes organizar las fotos desde Drive.

## Paso a paso

### 1. Sube las fotos a Drive

Recomendado: una carpeta por auto, por ejemplo `Autos / Nissan Versa 2021`. Usa fotos **JPG o PNG** horizontales. Cualquier tamaño sirve: el sitio pide a Drive una versión optimizada (máx. 1600 px).

### 2. Comparte cada foto como pública

En Drive, sobre **cada foto** (no sobre la carpeta):

1. Clic derecho → **Compartir** → **Compartir**.
2. En **Acceso general** cambia "Restringido" por **"Cualquier persona con el enlace"**.
3. Deja el rol en **Lector**.
4. Presiona **Copiar enlace**.

> Truco: si compartes la **carpeta** como "Cualquier persona con el enlace", todas las fotos que pongas dentro heredan ese permiso. Aun así necesitas el link de **cada foto** por separado.

El link copiado se ve así:

```
https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing
```

### 3. Pega los links en el panel

En el formulario del auto, campo **Imágenes**, pega **un link por línea**. La primera línea es la portada.

```
https://drive.google.com/file/d/1AbC…/view?usp=sharing      ← portada
https://drive.google.com/file/d/1DeF…/view?usp=sharing
https://drive.google.com/file/d/1GhI…/view?usp=sharing
```

### 4. Previsualiza y guarda

Presiona **Previsualizar imágenes**. Si todas se ven, presiona **Guardar**.

![Vista previa de imágenes](img/admin-imagenes.png)

## Links que funcionan

| Tipo de link | ¿Sirve? |
|---|---|
| `https://drive.google.com/file/d/ID/view?usp=sharing` (el de "Copiar enlace") | Sí |
| `https://drive.google.com/open?id=ID` | Sí |
| `https://drive.google.com/uc?export=view&id=ID` | Sí |
| `https://lh3.googleusercontent.com/d/ID` | Sí |
| Link directo `https://` a una imagen de otro sitio (`…/foto.jpg`) | Sí |
| Link de una **carpeta** `https://drive.google.com/drive/folders/…` | **No**: comparte cada foto |
| Cualquier link que empiece con `http://` (sin "s") | **No**: inseguro |
| `javascript:…`, `data:…` u otros | **No**: se bloquean por seguridad |

Todos los links de Drive se convierten automáticamente a `https://drive.google.com/thumbnail?id=ID&sz=w1600`, que es el formato que el navegador puede mostrar directo.

## Problemas comunes

| En la vista previa sale… | Solución |
|---|---|
| "No se pudo cargar. ¿Está compartida como "Cualquier persona con el enlace"?" | La foto está en modo "Restringido". Compártela como pública (paso 2) y vuelve a previsualizar |
| "El enlace es una carpeta de Drive…" | Pegaste el link de la carpeta. Abre la carpeta y copia el link de cada foto |
| "El enlace debe empezar con https://" | El link está incompleto o es `http://` |
| "No se encontró el ID del archivo de Drive" | El link está cortado. Cópialo otra vez con "Copiar enlace" |
| Antes se veía y ahora no | La foto se borró, se movió a la papelera o se le quitó el permiso público en Drive |

## Cosas a tener en cuenta

- **No borres** de Drive una foto que esté publicada: la página dejaría de mostrarla.
- Si cambias una foto en Drive **subiendo una nueva versión** del mismo archivo (clic derecho → Administrar versiones), el link sigue siendo el mismo y el sitio muestra la nueva (Drive puede tardar unos minutos en actualizar la miniatura).
- Cualquiera que tenga el link puede ver esa foto. No compartas así fotos con datos privados (placas, documentos, facturas).
- Google puede limitar la cantidad de vistas si una foto recibe muchísimo tráfico. Para el volumen de una agencia normalmente no pasa.
