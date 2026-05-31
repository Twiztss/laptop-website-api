# laptop-website-api

## Overview

`laptop-website-api` is a RESTful API backend designed to serve frontend applications (e.g., e-commerce platforms selling laptops or general tech products). Built with modern web technologies, it provides all the necessary endpoints to manage products, users, categories, shopping carts, and orders.

### Tech Stack

- Framework: **[ElysiaJS](https://elysiajs.com/)**
- Runtime: **[Bun](https://bun.sh/)**
- Database: **[Neon](https://neon.com/)**
- ORM: **[Prisma](https://www.prisma.io/)**

## Project Structure

```text
.
├── .agent/                 # Project documentation and guidelines (Architecture, Testing, Progress)
├── prisma/
│   └── schema.prisma       # Prisma database schema definition
├── src/
│   ├── generated/          # Auto-generated Prisma client
│   ├── lib/
│   │   ├── error.ts        # Global error handler and custom error classes
│   │   ├── prisma.ts       # Prisma client initialization
│   │   └── validation.ts   # TypeBox validation schemas for request inputs
│   ├── routes/
│   │   ├── product.route.ts# Product-related API endpoints
│   │   └── user.route.ts   # User-related API endpoints
│   ├── tests/              # bun:test integration and unit tests
│   └── index.ts            # Main application entry point and route registration
├── package.json            # Project dependencies and scripts
└── bun.lock                # Bun lockfile
```

## Getting Started

### Prerequisites

- **[Bun](https://bun.sh/)** v1.0.0 or higher.
- A PostgreSQL database (e.g., [Neon](https://neon.tech/)).

### Installation

1. Clone the repository and install dependencies:

    ```bash
    bun install
    ```

2. Set up your environment variables by creating a `.env` file in the root directory:
    ```env
    DATABASE_URL="postgres://user:password@host/database"
    JWT_SECRET="your_super_secret_key"
    JWT_EXPIRES_IN="7d"
    RATE_LIMIT=50
    RATE_LIMIT_DURATION=60000
    ```

### Development

To start the development server with hot-reload:

```bash
bun run dev
```

The server will be accessible at `http://localhost:3000/`.

### Testing

To execute the test suite:

```bash
bun test
```
