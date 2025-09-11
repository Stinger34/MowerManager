# MowerManager Docker Deployment Guide

## Prerequisites

- **Linux machine** (Ubuntu, Debian, CentOS, etc.)
- [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- Access to your code (e.g., via GitHub)

---

## 1. Clone Your Repository

```sh
git clone https://github.com/Stinger34/MowerManager.git
cd MowerManager
```

---

## 2. Review Your Folder Structure

Your structure should look like:

```
MowerManager/
├── client/
├── server/
├── shared/
├── drizzle.config.ts
├── docker-compose.yml
├── README.md
└── ...
```

---

## 3. Configure Environment Variables

- Create `.env` files as needed (root, `server/`, `client/`).
- Example root `.env`:

  ```env
  POSTGRES_USER=postgres
  POSTGRES_PASSWORD=yourpassword
  POSTGRES_DB=mower_manager
  ```

- Reference these in your `docker-compose.yml` and app configs.

---

## 4. Build and Start Docker Containers

From the root of your project:

```sh
docker-compose up --build -d
```

---

## 5. Run Drizzle Migrations

After containers are up, apply database migrations:

```sh
docker-compose exec server npx drizzle-kit migrate:deploy
```

This updates your Postgres DB to match your latest schema.

---

## 6. Verify Deployment

- **Check logs:**
  ```sh
  docker-compose logs
  ```
- **Access your frontend:**  
  `http://<your_server_ip>:<frontend_port>` (often `3000` or `5173`)
- **Backend:**  
  `http://<your_server_ip>:<backend_port>` (often `4000` or `8080`)

---

## 7. Manage Containers

- **Restart all services:**
  ```sh
  docker-compose restart
  ```
- **Stop all services:**
  ```sh
  docker-compose down
  ```
- **View running containers:**
  ```sh
  docker ps
  ```

---

## 8. (Optional) Automate Migrations

If you want migrations to run automatically on backend start, add this to your `server/Dockerfile` or entrypoint script:

```dockerfile
CMD ["sh", "-c", "npx drizzle-kit migrate:deploy && node dist/index.js"]
```

---

## 9. (Optional) Secure Your Server

- Set up a firewall (e.g., `ufw`)
- Use HTTPS for production (reverse proxy with Nginx, Caddy, etc.)
- Keep your system and Docker up to date

---

## Summary Checklist

1. Clone your repo
2. Set up `.env` files
3. `docker-compose up --build -d`
4. `docker-compose exec server npx drizzle-kit migrate:deploy`
5. Verify the app
6. Manage containers as needed

---

## Need More Help?

Let me know if you want a template for your `docker-compose.yml`, `.env` files, or anything else!
