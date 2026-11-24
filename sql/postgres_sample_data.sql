INSERT INTO categories (category_name, description) VALUES
('Groceries','Daily use food and grocery items'),
('Electronics','Electronic devices and accessories'),
('Beverages','Drinks, juices and cold beverages'),
('Stationery','Office and school stationery supplies'),
('Cleaning','Cleaning and hygiene products');

INSERT INTO products (product_name,category_id,unit_price,cost_price,unit_type,stock_qty,reorder_level) VALUES
('Basmati Rice 25kg',1,1800,1500,'bag',50,10),('Wheat Flour 10kg',1,450,380,'bag',80,15),
('Sugar 50kg',1,2200,1950,'bag',40,10),('Refined Oil 15L',1,1650,1430,'tin',60,10),
('Toor Dal 5kg',1,700,600,'packet',100,20),('LED Bulb 9W',2,85,60,'piece',200,30),
('USB Charger 2A',2,250,180,'piece',8,25),('Extension Board 4-plug',2,380,290,'piece',75,15),
('AA Battery (Pack of 4)',2,90,65,'pack',3,50),('Coca-Cola 2L (Case 6)',3,480,390,'case',90,20),
('Mineral Water 1L x 12',3,180,140,'case',0,25),('Tea Bags 100pcs',3,220,170,'box',160,30),
('A4 Paper 500 sheets',4,320,260,'ream',80,15),('Ball Pen Box (10pc)',4,90,65,'box',250,40),
('Detergent Powder 5kg',5,450,370,'bag',130,25),('Floor Cleaner 5L',5,380,300,'can',70,15);

INSERT INTO customers (customer_name,phone,email,address,gst_number,credit_limit) VALUES
('Ramesh General Store','9876543210','ramesh@gmail.com','12, MG Road, Delhi','07AABCU9603R1ZP',75000),
('Sharma Brothers Mart','9812345678','sharma@gmail.com','45, Civil Lines, Agra','09AAHCS8586R1ZT',100000),
('Patel Supermarket','9701234567','patel@gmail.com','78, Station Road, Surat','24AACCP9801R1ZA',60000),
('City Retail Hub','9988776655','cityretail@gmail.com','33, Park Street, Kolkata','19AABCC1234R1ZB',150000),
('Gupta Wholesale Depot','9654321098','gupta@gmail.com','55, Nehru Nagar, Kanpur','09AAECG2345R1ZC',200000);

INSERT INTO bills (customer_id,bill_date,total_amount,discount_pct,tax_pct,final_amount,payment_status,payment_mode) VALUES
(1,'2024-05-10',10500,5,18,11799,'Paid','Cash'),(2,'2024-05-12',25000,8,18,27260,'Paid','Online'),
(3,'2024-05-15',8000,0,18,9440,'Unpaid','Credit'),(4,'2024-05-18',45000,10,18,47628,'Partial','Credit'),
(5,'2024-05-20',18000,5,18,20214,'Paid','Online'),(1,'2024-05-22',12000,0,18,14160,'Unpaid','Credit');

INSERT INTO bill_items (bill_id,product_id,quantity,unit_price,subtotal) VALUES
(1,1,3,1800,5400),(1,3,2,2200,4400),(1,7,3,250,750),(2,4,5,1650,8250),(2,2,8,450,3600),
(3,6,40,85,3400),(3,9,50,90,4500),(4,1,10,1800,18000),(4,4,8,1650,13200),(5,2,20,450,9000),(6,13,20,320,6400);
