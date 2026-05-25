# API de Imagens — DK Fashion

Como funciona o módulo de imagens (`src/images/`) e passo a passo para usá-lo.

## Visão geral

O módulo separa **a imagem em si** (`image`) do **vínculo da imagem com uma
variante de produto** (`catalog_image`). Uma mesma imagem pode ser reaproveitada
em várias variantes, cada vínculo com sua própria ordem de exibição.

Há dois jeitos de registrar uma imagem:

| Forma                    | Endpoint              | Quando usar                                            |
| ------------------------ | --------------------- | ------------------------------------------------------ |
| Por URL                  | `POST /api/images`    | A imagem já está hospedada em algum lugar; só guardamos a URL. |
| Por upload (ImgBB)       | `POST /api/images/upload` | Sobe o arquivo pro ImgBB e guarda a URL devolvida.     |

Depois de registrada, a imagem é vinculada a uma variante via
`POST /api/images/catalog`.

## Autorização

Os três `POST` exigem `JwtAuthGuard` + `RolesGuard` com papel
`GERENTE` ou `ADMINISTRADOR`. O `GET /api/images/catalog/:variantSku` é
**público** (sem auth) — é o que o site usa para montar a galeria.

## Endpoints

### `POST /api/images` — registrar por URL

Body (`CreateImageDto`):

```json
{
  "url": "https://cdn.exemplo.com/foto.jpg",
  "ordem": 0,
  "descricao": "Vestido visto de frente",
  "local_renderizacao": "miniatura"
}
```

- `url`: validada como URL (`z.url()`), máx 500 caracteres.
- `ordem`, `descricao`, `local_renderizacao`: opcionais.

Retorna a `Image` criada (com `id_imagem`).

### `POST /api/images/upload` — upload pro ImgBB

`multipart/form-data` com o campo `file` (obrigatório) + os mesmos campos
opcionais (`ordem`, `descricao`, `local_renderizacao`).

- Aceita apenas `image/jpeg|png|gif|webp` (validado no `fileFilter`).
- Tamanho máximo: `MAX_IMAGE_UPLOAD_BYTES` (5 MB).
- O arquivo é mantido em memória (`memoryStorage`), enviado ao ImgBB pelo
  `ImgbbService` e a `url` devolvida é persistida como uma `Image` normal.

Requer `IMGBB_API_KEY` no ambiente. Sem a chave, o endpoint responde
`500` (`IMGBB_API_KEY não configurada`). Erros vindos do ImgBB viram `400`.

### `POST /api/images/catalog` — vincular imagem a uma variante

Body (`CreateCatalogImageDto`):

```json
{
  "imageId": 12,
  "variantSku": "VEST-AZUL-M",
  "ordem_no_catalogo": 0
}
```

- Valida que a `Image` (`imageId`) e a `ProductVariant` (`variantSku`)
  existem — `404` caso contrário.
- `ordem_no_catalogo` define a ordem da imagem dentro da galeria daquela
  variante (default 0).

Cria a linha em `catalog_image` (PK composta `id_imagem` + `codigo_sku`).

### `GET /api/images/catalog/:variantSku` — listar galeria da variante

Retorna os vínculos `CatalogImage` da variante, com a `image` aninhada,
**ordenados por `ordem_no_catalogo` (ASC)**. `404` se a variante não existir.

## Modelo de dados

- `image` (`id_imagem`, `url`, `ordem`, `descricao`, `local_renderizacao`).
- `catalog_image` (PK `id_imagem` + `codigo_sku`, `ordem_no_catalogo`) —
  junção N:N entre `image` e `product_variant`.

## Fluxo típico (cadastro de produto)

1. `POST /api/images/upload` (ou `POST /api/images` com URL) → obtém `id_imagem`.
2. `POST /api/images/catalog` ligando o `id_imagem` à variante (`codigo_sku`),
   definindo `ordem_no_catalogo`.
3. O site consome `GET /api/images/catalog/:variantSku` para renderizar a
   galeria na ordem definida.
