ResQue Audit Logging Frontend
A standalone Next.js 15 frontend for super admins to monitor audit logs in the ResQue Queue System, filter logs, and truncate old logs to manage database storage.
Features

Secure Login: Super admins log in with username (superadmin) and password (super123).
Audit Log Dashboard: View logs in a table with filters for user ID, action, status, and date range.
Error Highlighting: Failed actions are highlighted in red.
Truncate Logs: Delete logs before a specified date with a confirmation modal.
Pagination: Display logs in pages (10 logs per page).
Responsive Design: Works on desktop and mobile.
Notifications: Toast messages for success and error feedback.

Prerequisites

Node.js (v18 or higher)
PostgreSQL with the resque database and required tables (audit_logs, menu_items, cart_items, users, queues, orders)

Installation

Create the project directory and initialize Next.js:
mkdir resque-audit-frontend
cd resque-audit-frontend
npx create-next-app@15 . --js --eslint --tailwind --app --src-dir --import-alias "@/*"


Install dependencies:
npm install axios react-toastify typeorm pg jsonwebtoken bcryptjs


Set up environment variables in .env.local:
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=resque
JWT_SECRET=your-secret-key


Start the development server:
npm run dev



Usage

Login:

Visit http://localhost:3000/login.
Enter username: superadmin and password: super123.
On successful login, you’ll be redirected to the dashboard.


View Audit Logs:

On the dashboard, view logs in a table.
Use filters to search by user ID, action (e.g., placeOrder, addMenuItem), status (success, failed), or date range.
Failed logs are highlighted in red with status badges.


Truncate Logs:

Select a date in the "Clear Old Logs" section.
Click "Clear Old Logs" to open a confirmation modal.
Confirm to delete logs before the selected date.
Receive a success or error toast notification.


Pagination:

Navigate through pages using the pagination buttons below the table.



Notes

Database: The audit_logs table is managed via TypeORM with synchronize: true for development. Set to false in production.
Security: API routes require JWT authentication. Only super admins can access the dashboard and truncate logs.
Production: Replace hardcoded credentials with a check against the users table.
Performance: Pagination is implemented to handle large log tables efficiently.

File Structure
resque-audit-frontend/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/login/route.js
│   │   │   ├── audit/logs/route.js
│   │   │   ├── audit/truncate/route.js
│   │   ├── login/page.js
│   │   ├── dashboard/page.js
│   │   ├── globals.css
│   │   ├── layout.js
│   │   ├── page.js
│   ├── components/
│   │   ├── ProtectedRoute.js
│   │   ├── AuditTable.js
│   ├── lib/
│   │   ├── database.js
│   │   ├── auth.js
│   ├── entities/
│   │   ├── AuditLogEntity.js
├── tailwind.config.js
├── next.config.mjs
├── package.json
├── README.md

Dependencies

next: Next.js 15
axios: API requests
react-toastify: Notifications
typeorm: Database operations
pg: PostgreSQL driver
jsonwebtoken: JWT authentication
bcryptjs: Password hashing

Environment Variables

DB_HOST: Database host (e.g., localhost)
DB_PORT: Database port (e.g., 5432)
DB_USERNAME: Database username (e.g., postgres)
DB_PASSWORD: Database password
DB_NAME: Database name (e.g., resque)
JWT_SECRET: Secret key for JWT

Security Notes

Hardcoded credentials are used for simplicity. In production, authenticate against the users table.
Ensure JWT_SECRET is secure and unique.
Set synchronize: false in production to prevent accidental schema changes.

