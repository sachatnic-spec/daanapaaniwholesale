const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '2mb' }));

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5433),
    database: process.env.PGDATABASE || 'wholesale_shop_db',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres'
});

const sessions = new Map();

function createToken(user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId: user.user_id, username: user.username, displayName: user.display_name, role: user.role });
    return token;
}

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.body?.authToken;
    const session = sessions.get(token);
    if (!session) return res.status(401).json({ error: 'Please sign in again.' });
    req.user = session;
    next();
}

async function addAudit(req, action, entityType, entityId, details) {
    await pool.query(`INSERT INTO audit_log(user_id,username,action,entity_type,entity_id,details,ip_address)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [req.user.userId, req.user.username, action, entityType, entityId, details, req.ip || null]);
}

async function deductInventory(client, productId, qty, billId) {
    const quantity = Number(qty);

    if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for product ID ${productId}`);
    }

    // Deduct stock only if sufficient inventory is available
    const result = await client.query(
        `UPDATE products
         SET stock_qty = stock_qty - $1
         WHERE product_id = $2
         AND stock_qty >= $1
         RETURNING stock_qty`,
        [quantity, productId]
    );

    if (result.rowCount === 0) {
        throw new Error(
            `Insufficient stock or product not found. Product ID: ${productId}`
        );
    }

    // Maintain inventory transaction history
    await client.query(
        `INSERT INTO inventory_log
         (product_id, change_type, quantity, remarks)
         VALUES ($1, $2, $3, $4)`,
        [
            productId,
            'Sale',
            -quantity,
            `Stock deducted for Bill #${billId}`
        ]
    );
}


app.post('/api/auth/login', async (req, res, next) => {
    try {
        const username = String(req.body.username || '').trim().toLowerCase();
        const password = String(req.body.password || '');
        const result = await pool.query('SELECT * FROM app_users WHERE LOWER(username)=LOWER($1) AND is_active=TRUE', [username]);
        if (!result.rows.length) return res.status(401).json({ error: 'Invalid username or password.' });
        const user = result.rows[0];
        const hash = crypto.pbkdf2Sync(password, user.password_salt, 120000, 64, 'sha512').toString('hex');
        const stored = Buffer.from(user.password_hash, 'hex');
        const incoming = Buffer.from(hash, 'hex');
        if (stored.length !== incoming.length || !crypto.timingSafeEqual(stored, incoming)) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }
        const token = createToken(user);
        res.json({ token, user: { id: user.user_id, username: user.username, displayName: user.display_name, role: user.role } });
    } catch (error) { next(error); }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    sessions.delete(token);
    res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: req.user }));

async function initDatabase() {
    const table = await pool.query("SELECT to_regclass('public.categories') AS name");
    if (!table.rows[0].name) {
        await pool.query(fs.readFileSync(path.join(__dirname, '..', 'sql', 'postgres_schema.sql'), 'utf8'));
        await pool.query(fs.readFileSync(path.join(__dirname, '..', 'sql', 'postgres_sample_data.sql'), 'utf8'));
    }

    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(12,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS due_date DATE`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS repeat_order_days INTEGER NOT NULL DEFAULT 30`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS photo_data TEXT`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)`);
    await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS customer_rates (
        customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
        custom_unit_price NUMERIC(10,2) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (customer_id, product_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS app_users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(150) NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role VARCHAR(30) NOT NULL DEFAULT 'staff',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS audit_log (
        audit_id BIGSERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES app_users(user_id),
        username VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id INTEGER,
        details TEXT,
        ip_address VARCHAR(60),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS expenses (
        expense_id SERIAL PRIMARY KEY,
        expense_date DATE NOT NULL,
        description VARCHAR(200) NOT NULL,
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        notes TEXT,
        created_by INTEGER REFERENCES app_users(user_id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES app_users(user_id)`);
    await pool.query(`ALTER TABLE bills ADD COLUMN IF NOT EXISTS paid_by INTEGER REFERENCES app_users(user_id)`);

    await pool.query(`CREATE TABLE IF NOT EXISTS orders (
        order_id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
        order_date DATE NOT NULL,
        delivery_status VARCHAR(20) NOT NULL DEFAULT 'Pending',
        delivery_date DATE,
        notes TEXT,
        bill_id INTEGER REFERENCES bills(bill_id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES app_users(user_id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
        order_item_id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
        quantity INTEGER NOT NULL,
        unit_price NUMERIC(10,2) NOT NULL,
        subtotal NUMERIC(12,2) NOT NULL
    )`);

    const admin = await pool.query('SELECT user_id FROM app_users WHERE username=$1', ['admin']);
    if (!admin.rows.length) {
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync('admin123', salt, 120000, 64, 'sha512').toString('hex');
        await pool.query(`INSERT INTO app_users(username,display_name,password_hash,password_salt,role)
            VALUES('admin','Administrator',$1,$2,'admin')`, [hash, salt]);
    }
}

app.get('/api/db', requireAuth, async (_req, res, next) => {
    try {
        const [categories, products, customers, bills, inventory, customerRates, orders, orderItems, billItems, expenses] = await Promise.all([
            pool.query('SELECT category_id id, category_name name FROM categories ORDER BY category_id'),
            pool.query('SELECT product_id id, product_name name, category_id "categoryId", unit_price "unitPrice", cost_price "costPrice", unit_type unit, stock_qty stock, reorder_level reorder FROM products ORDER BY product_id'),
            pool.query('SELECT customer_id id, customer_name name, phone, email, address, gst_number gst, credit_limit credit, repeat_order_days "repeatOrderDays", photo_data "photoData", latitude, longitude FROM customers ORDER BY customer_id'),
            pool.query(`SELECT b.bill_id id,b.customer_id "customerId",b.bill_date::text date,b.due_date::text "dueDate",b.total_amount total,b.discount_pct discount,b.tax_pct tax,b.final_amount final,b.paid_amount "paidAmount",b.balance_amount "balanceAmount",b.payment_status status,b.payment_mode mode,b.created_by "createdBy",b.paid_by "paidBy",c1.username "createdByName",c2.username "paidByName" FROM bills b LEFT JOIN app_users c1 ON c1.user_id=b.created_by LEFT JOIN app_users c2 ON c2.user_id=b.paid_by ORDER BY b.bill_id`),
            pool.query('SELECT il.log_id id, il.product_id "productId", il.change_type type, il.quantity qty, il.remarks, il.log_date::text date FROM inventory_log il ORDER BY il.log_id'),
            pool.query('SELECT customer_id "customerId", product_id "productId", custom_unit_price "customUnitPrice" FROM customer_rates'),
            pool.query(`SELECT o.order_id id,o.customer_id "customerId",o.order_date::text "orderDate",o.delivery_status "deliveryStatus",o.delivery_date::text "deliveryDate",o.notes,o.bill_id "billId",o.created_by "createdBy",u.username "createdByName",o.created_at::text "createdAt" FROM orders o LEFT JOIN app_users u ON u.user_id=o.created_by ORDER BY o.order_date DESC,o.order_id DESC`),
            pool.query('SELECT order_item_id id,order_id "orderId",product_id "productId",quantity,unit_price "unitPrice",subtotal FROM order_items ORDER BY order_item_id'),
            pool.query('SELECT bi.item_id id, bi.bill_id "billId", bi.product_id "productId", bi.quantity, bi.unit_price "unitPrice", bi.subtotal FROM bill_items bi ORDER BY bi.item_id'),
            pool.query(`SELECT e.expense_id id,e.expense_date::text date,e.description,e.amount,e.notes,u.username "createdByName" FROM expenses e LEFT JOIN app_users u ON u.user_id=e.created_by ORDER BY e.expense_date DESC,e.expense_id DESC`)
        ]);
        res.json({ categories: categories.rows, products: products.rows, customers: customers.rows, bills: bills.rows, inventory: inventory.rows, customerRates: customerRates.rows, orders: orders.rows, orderItems: orderItems.rows, billItems: billItems.rows, expenses: expenses.rows, nextId: { products: 100000, customers: 100000, bills: 100000 } });
    } catch (error) { next(error); }
});

app.post('/api/expenses', requireAuth, async (req, res, next) => {
    try {
        const description = String(req.body.description || '').trim();
        const date = String(req.body.date || '').trim();
        const amount = Number(req.body.amount);
        const notes = String(req.body.notes || '').trim();
        const parsedDate = new Date(`${date}T00:00:00.000Z`);
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
        if (!description || description.length > 200 || !validDate || !Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Enter a description, valid date, and amount greater than zero.' });
        }
        const result = await pool.query(`INSERT INTO expenses(expense_date,description,amount,notes,created_by)
            VALUES($1,$2,$3,$4,$5) RETURNING expense_id`, [date, description, amount, notes || null, req.user.userId]);
        const id = result.rows[0].expense_id;
        await addAudit(req, 'RECORD_EXPENSE', 'expense', id, `${description}; amount=${amount}; date=${date}`);
        res.json({ id });
    } catch (error) { next(error); }
});

app.delete('/api/expenses/:id', requireAuth, async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM expenses WHERE expense_id=$1 RETURNING description,amount', [req.params.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Expense not found.' });
        const expense = result.rows[0];
        await addAudit(req, 'DELETE_EXPENSE', 'expense', Number(req.params.id), `${expense.description}; amount=${expense.amount}`);
        res.json({ ok: true });
    } catch (error) { next(error); }
});

app.post('/api/products', requireAuth, async (req, res, next) => {
    try {
        const p = req.body;
        let result;
        if (p.id) result = await pool.query(`UPDATE products SET product_name=$1,category_id=$2,unit_price=$3,cost_price=$4,unit_type=$5,stock_qty=$6,reorder_level=$7 WHERE product_id=$8 RETURNING product_id`, [p.name, p.categoryId, p.unitPrice, p.costPrice, p.unit, p.stock, p.reorder, p.id]);
        else result = await pool.query(`INSERT INTO products(product_name,category_id,unit_price,cost_price,unit_type,stock_qty,reorder_level) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING product_id`, [p.name, p.categoryId, p.unitPrice, p.costPrice, p.unit, p.stock, p.reorder]);
        res.json({ id: result.rows[0].product_id });
    } catch (error) { next(error); }
});

app.delete('/api/products/:id', requireAuth, async (req, res, next) => {
    try { await pool.query('DELETE FROM products WHERE product_id=$1', [req.params.id]); res.json({ ok: true }); }
    catch (error) { next(error); }
});

app.post('/api/customers', requireAuth, async (req, res, next) => {
    try {
        const c = req.body;
        let result;
        if (c.id) result = await pool.query(`UPDATE customers SET customer_name=$1,phone=$2,email=$3,address=$4,gst_number=$5,credit_limit=$6,repeat_order_days=$7,photo_data=$8,latitude=$9,longitude=$10 WHERE customer_id=$11 RETURNING customer_id`, [c.name, c.phone, c.email, c.address, c.gst, c.credit, c.repeatOrderDays || 30, c.photoData || null, c.latitude ?? null, c.longitude ?? null, c.id]);
        else result = await pool.query(`INSERT INTO customers(customer_name,phone,email,address,gst_number,credit_limit,repeat_order_days,photo_data,latitude,longitude) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING customer_id`, [c.name, c.phone, c.email, c.address, c.gst, c.credit, c.repeatOrderDays || 30, c.photoData || null, c.latitude ?? null, c.longitude ?? null]);
        res.json({ id: result.rows[0].customer_id });
    } catch (error) { next(error); }
});

app.delete('/api/customers/:id', requireAuth, async (req, res, next) => {
    try { await pool.query('DELETE FROM customers WHERE customer_id=$1', [req.params.id]); res.json({ ok: true }); }
    catch (error) { next(error); }
});

app.post('/api/bills', requireAuth, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const b = req.body;
        const paidAmount = 0;
        const balanceAmount = Number(b.final);
        const bill = await client.query(`INSERT INTO bills(customer_id,bill_date,due_date,total_amount,discount_pct,tax_pct,final_amount,paid_amount,balance_amount,payment_status,payment_mode,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING bill_id`, [b.customerId, b.date, b.dueDate || null, b.total, b.discount, 0, b.final, paidAmount, balanceAmount, 'Unpaid', b.mode, req.user.userId]);
        const billId = bill.rows[0].bill_id;
        for (const item of b.items || []) {
            await client.query('INSERT INTO bill_items(bill_id,product_id,quantity,unit_price,subtotal) VALUES($1,$2,$3,$4,$5)', [billId, item.productId, item.qty, item.unitPrice, item.subtotal]);
            // 2. Deduct inventory
            await deductInventory(
                client,
                item.productId,
                item.qty,
                billId
            );
            await client.query(`INSERT INTO customer_rates(customer_id,product_id,custom_unit_price,updated_at)
                VALUES($1,$2,$3,CURRENT_TIMESTAMP)
                ON CONFLICT (customer_id,product_id)
                DO UPDATE SET custom_unit_price=EXCLUDED.custom_unit_price,updated_at=CURRENT_TIMESTAMP`, [b.customerId, item.productId, item.unitPrice]);
        }
        await client.query('COMMIT');
        if (b.orderId) {
            await pool.query(`UPDATE orders SET bill_id=$1 WHERE order_id=$2`, [billId, b.orderId]);
        }
        await addAudit(req, 'GENERATE_BILL', 'bill', billId, `Customer=${b.customerId}; amount=${b.final}; mode=${b.mode}; order=${b.orderId || ''}`);
        res.json({ id: billId });
    } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

app.post('/api/bills/:id/pay', requireAuth, async (req, res, next) => {
    try {
        const amountInput = req.body.amount;
        const amount = Number(amountInput);
        const mode = req.body.mode || 'Cash';
        const dueDate = req.body.dueDate ? String(req.body.dueDate).trim() : null;
        if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            return res.status(400).json({ error: 'Enter a valid collection due date.' });
        }
        if (amountInput === undefined || amountInput === null || String(amountInput).trim() === '' || !Number.isFinite(amount) || amount < 0) {
            return res.status(400).json({ error: 'Enter a valid amount of zero or more.' });
        }
        const bill = await pool.query('SELECT final_amount, COALESCE(paid_amount,0) paid_amount FROM bills WHERE bill_id=$1', [req.params.id]);
        if (!bill.rows.length) return res.status(404).json({ error: 'Bill not found' });

        const currentPaid = Number(bill.rows[0].paid_amount) || 0;
        const currentPending = Number(bill.rows[0].final_amount) - currentPaid;
        if (amount > currentPending) {
            return res.status(400).json({ error: 'Paid amount cannot exceed the pending amount.' });
        }
        if (amount === 0) {
            const balanceAmount = Math.max(currentPending, 0);
            if (balanceAmount > 0 && !dueDate) {
                return res.status(400).json({ error: 'Collection Due Date is required for a remaining balance.' });
            }
            const status = balanceAmount === 0 ? 'Paid' : currentPaid > 0 ? 'Partial' : 'Unpaid';
            const savedDueDate = balanceAmount === 0 ? null : dueDate;
            await pool.query('UPDATE bills SET due_date=$1 WHERE bill_id=$2', [savedDueDate, req.params.id]);
            await addAudit(req, 'UPDATE_BILL_DUE_DATE', 'bill', Number(req.params.id), `Updated due date without collecting payment; balance=${balanceAmount}; dueDate=${savedDueDate || 'cleared'}`);
            return res.json({ paidAmount: currentPaid, balanceAmount, status, dueDate: savedDueDate });
        }
        const paidAmount = Math.min(Number(bill.rows[0].final_amount), currentPaid + amount);
        const balanceAmount = Math.max(Number(bill.rows[0].final_amount) - paidAmount, 0);
        const status = balanceAmount === 0 ? 'Paid' : 'Partial';
        if (balanceAmount > 0 && !dueDate) {
            return res.status(400).json({ error: 'Collection Due Date is required for a remaining balance.' });
        }
        const savedDueDate = balanceAmount === 0 ? null : dueDate;
        await pool.query(`UPDATE bills SET paid_amount=$1,balance_amount=$2,payment_status=$3,payment_mode=$4,paid_by=$5,due_date=$6 WHERE bill_id=$7`, [paidAmount, balanceAmount, status, mode, req.user.userId, savedDueDate, req.params.id]);
        await addAudit(req, 'COLLECT_PAYMENT', 'bill', Number(req.params.id), `Collected ${amount}; paid=${paidAmount}; balance=${balanceAmount}; mode=${mode}; dueDate=${savedDueDate || 'cleared'}`);
        res.json({ paidAmount, balanceAmount, status, dueDate: savedDueDate });
    } catch (error) { next(error); }
});

app.post('/api/inventory', requireAuth, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const e = req.body;
        await client.query(`INSERT INTO inventory_log(product_id,change_type,quantity,remarks) VALUES($1,$2,$3,$4)`, [e.productId, e.type, e.qty, e.remarks]);
        await client.query('UPDATE products SET stock_qty=GREATEST(stock_qty+$1,0) WHERE product_id=$2', [e.qty, e.productId]);
        await client.query('COMMIT');
        res.json({ ok: true });
    } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

app.post('/api/orders', requireAuth, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const o = req.body;
        const order = await client.query(`INSERT INTO orders(customer_id,order_date,delivery_status,delivery_date,notes,created_by)
            VALUES($1,$2,$3,$4,$5,$6) RETURNING order_id`, [o.customerId, o.orderDate, o.deliveryStatus || 'Pending', o.deliveryDate || null, o.notes || null, req.user.userId]);
        const orderId = order.rows[0].order_id;
        for (const item of o.items || []) {
            await client.query(`INSERT INTO order_items(order_id,product_id,quantity,unit_price,subtotal)
                VALUES($1,$2,$3,$4,$5)`, [orderId, item.productId, item.qty, item.unitPrice, item.subtotal]);
        }
        await client.query('COMMIT');
        await addAudit(req, 'RECORD_ORDER', 'order', orderId, `Customer=${o.customerId}; date=${o.orderDate}; status=${o.deliveryStatus || 'Pending'}`);
        res.json({ id: orderId });
    } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

app.post('/api/orders/:id/status', requireAuth, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const status = req.body.deliveryStatus || 'Pending';
        const deliveryDate = req.body.deliveryDate || null;
        const orderResult = await client.query('SELECT customer_id, bill_id FROM orders WHERE order_id=$1', [req.params.id]);
        if (!orderResult.rows.length) return res.status(404).json({ error: 'Order not found.' });

        const order = orderResult.rows[0];
        await client.query(`UPDATE orders SET delivery_status=$1,delivery_date=$2 WHERE order_id=$3`, [status, deliveryDate, req.params.id]);

        if (status === 'Delivered' && !order.bill_id) {
            const items = await client.query(`SELECT product_id,quantity,unit_price,subtotal FROM order_items WHERE order_id=$1`, [req.params.id]);
            const total = items.rows.reduce((sum, item) => sum + Number(item.subtotal), 0);
            const bill = await client.query(`INSERT INTO bills(customer_id,bill_date,due_date,total_amount,discount_pct,tax_pct,final_amount,paid_amount,balance_amount,payment_status,payment_mode,created_by)
                VALUES($1,CURRENT_DATE,NULL,$2,0,0,$2,0,$2,'Unpaid','Cash',$3) RETURNING bill_id`, [order.customer_id, total, req.user.userId]);
            const billId = bill.rows[0].bill_id;
            for (const item of items.rows) {
                await client.query(`INSERT INTO bill_items(bill_id,product_id,quantity,unit_price,subtotal) VALUES($1,$2,$3,$4,$5)`, [billId, item.product_id, item.quantity, item.unit_price, item.subtotal]);
            }
            await client.query(`UPDATE orders SET bill_id=$1 WHERE order_id=$2`, [billId, req.params.id]);
            await addAudit(req, 'GENERATE_BILL', 'bill', billId, `Auto-generated from delivered order=${req.params.id}; amount=${total}`);
        }

        await client.query('COMMIT');
        await addAudit(req, 'UPDATE_ORDER_STATUS', 'order', Number(req.params.id), `Status=${status}; deliveryDate=${deliveryDate || ''}`);
        res.json({ ok: true });
    } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

app.use(express.static(path.join(__dirname, '..')));
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: error.message }); });

const port = Number(process.env.PORT || 3000);
initDatabase().then(() => {
    app.listen(port, () => console.log(`Wholesale Shop running at http://localhost:${port}`));
}).catch(error => { console.error('Database initialization failed:', error); process.exit(1); });
