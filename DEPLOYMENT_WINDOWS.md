# DaanaPaani Traders - Windows Deployment

## Build package

Use:

`DaanaPaani-Traders-Windows-Build.zip`

## Windows requirements

1. Install PostgreSQL 16 or 17.
2. Install Node.js 20 or newer.
3. PostgreSQL user: `postgres`
4. PostgreSQL password: `postgres`
5. Application port: `3000`

## Deploy on another Windows machine

1. Install PostgreSQL and Node.js.
2. Extract the ZIP to a folder, for example `C:\DaanaPaani-Traders`.
3. Open Command Prompt in that folder.
4. Run:

```bat
npm install --omit=dev
start-app.bat
```

5. Open:

```text
http://localhost:3000
```

## Database setup

The Node server initializes the database schema automatically when the `wholesale_shop_db` database exists.

Create it using pgAdmin or psql:

```sql
CREATE DATABASE wholesale_shop_db;
```

If the PostgreSQL password is different, edit these values in `start-app.bat`:

```bat
set PGHOST=localhost
set PGPORT=5432
set PGDATABASE=wholesale_shop_db
set PGUSER=postgres
set PGPASSWORD=postgres
set PORT=3000
```

You can also set environment variables externally before starting the application.

## Stop and restart

Stop: close the server Command Prompt or press `Ctrl+C`.
Restart: run `start-app.bat`.

## PostgreSQL service

If PostgreSQL is stopped:

```bat
net start postgresql-x64-16
```

Replace `16` with your installed PostgreSQL major version.
