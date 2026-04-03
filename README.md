# MarketPlace Backend

A professional NestJS backend for a **party dress e-commerce and ERP system**, built with TypeScript, Prisma ORM, JWT authentication, RBAC, and Swagger documentation.

## Tech Stack

| Technology | Purpose |
|---|---|
| **NestJS** (TypeScript) | Framework / MVC Architecture |
| **Prisma ORM** | Database access (PostgreSQL) |
| **PostgreSQL** | Primary database (via Docker) |
| **Passport.js + JWT** | Authentication |
| **RBAC Guards** | Role-based access control |
| **Class-validator** | Request DTO validation |
| **Swagger/OpenAPI** | API documentation |

## Architecture

```
src/
├── prisma/          # PrismaService (database connection)
├── auth/            # JWT auth, guards, strategies, decorators
├── users/           # UsersModule (CRUD, role management)
├── products/        # ProductsModule (dress catalog with measurements)
├── inventory/       # InventoryModule (stock sync + audit logs)
├── sales/           # SalesModule (sales + 2.5% commission)
└── providers/
    ├── correios/    # Correios shipping stub
    ├── infinitepay/ # InfinitePay payment stub
    └── whatsapp/    # WhatsApp API stub
```

## Roles & Permissions

| Role | Permissions |
|---|---|
| **ADMIN** | Full access to all endpoints |
| **MANAGER** | Products, Inventory (including manual stock adjustment), Sales |
| **SELLER** | Create sales, view own sales, view products |
| **CUSTOMER** | View active products |

## Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose
- npm ≥ 10

## Setup

### 1. Clone & Install Dependencies

```bash
git clone <repo-url>
cd MarketPlace-Backend
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your values (or use the defaults for local development):

```env
DATABASE_URL="postgresql://marketplace_user:marketplace_pass@localhost:5432/marketplace_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRATION="7d"
PORT=3000
```

### 3. Start PostgreSQL with Docker

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port `5432`
- **pgAdmin** on port `5050` (login: `admin@marketplace.com` / `admin123`)

### 4. Run Prisma Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init
```

### 5. Start the Application

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API will be available at: `http://localhost:3000`

## API Documentation

Swagger UI is available at: **`http://localhost:3000/api/docs`**

## Key Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive JWT token |
| `GET` | `/auth/profile` | Get current user profile |

### Products
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/products` | Admin/Manager | Create product with dress measurements |
| `GET` | `/products` | All | List active products (filter by category/search) |
| `GET` | `/products/:id` | All | Get product details |
| `PATCH` | `/products/:id` | Admin/Manager | Update product |
| `DELETE` | `/products/:id` | Admin/Manager | Soft-delete product |

### Inventory
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `GET` | `/inventory` | Admin/Manager | List all inventory |
| `GET` | `/inventory/product/:productId` | Admin/Manager | Get product inventory + audit logs |
| `PATCH` | `/inventory/product/:productId/adjust` | Manager/Admin | Manual stock adjustment (creates audit log) |
| `GET` | `/inventory/audit-logs` | Admin/Manager | View all audit logs |

### Sales
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/sales` | Seller/Manager/Admin | Create a sale (auto-calculates 2.5% commission) |
| `GET` | `/sales` | Admin/Manager | List all sales |
| `GET` | `/sales/my-sales` | Seller | List seller's own sales |
| `GET` | `/sales/:id` | Seller/Manager/Admin | Get sale details |
| `PATCH` | `/sales/:id/status` | Admin/Manager | Update sale status |

### Users
| Method | Endpoint | Role | Description |
|---|---|---|---|
| `POST` | `/users` | Admin | Create user |
| `GET` | `/users` | Admin/Manager | List all users |
| `GET` | `/users/:id` | Admin/Manager | Get user |
| `PATCH` | `/users/:id` | Admin | Update user |
| `DELETE` | `/users/:id` | Admin | Delete user |

## Product Categories (DressCategory)

- `MIDI` — Midi-length dresses
- `LONGO` — Long dresses
- `EVENTO` — Event/formal dresses
- `CASUAL` — Casual dresses
- `FESTA` — Party dresses

## Dress Measurements

Products support the following measurement fields (in centimetres):
- `bust` — Bust circumference
- `waist` — Waist circumference
- `hips` — Hip circumference
- `length` — Full dress length

## External Service Stubs

The following external service integrations are implemented as stubs ready to be replaced with real API calls:

| Service | Location | Purpose |
|---|---|---|
| **Correios** | `src/providers/correios/` | Shipping quotes and package tracking |
| **InfinitePay** | `src/providers/infinitepay/` | Payment processing (credit, debit, PIX, boleto) |
| **WhatsApp** | `src/providers/whatsapp/` | Order notifications and messaging |

## Running Tests

```bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## Prisma Commands

```bash
# Open Prisma Studio (database GUI)
npx prisma studio

# Create a new migration
npx prisma migrate dev --name <migration-name>

# Reset database
npx prisma migrate reset

# Generate client after schema changes
npx prisma generate
```
