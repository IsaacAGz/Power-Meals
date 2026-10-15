# **Engineering Prompt: Power Meals Retail Platform (v2 Scale-Up)**

## **Tech Stack & Environment Constraints**

* **Frontend & Backend Framework:** Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS v4. (Transitioning away from static export output: "export" to a full Node.js server app).  
* **Hosting Infrastructure:** AWS EC2 instance.  
* **Proxy & Security:** Nginx (already configured on EC2 for reverse proxying and rate limiting) combined with Amazon CloudFront for static edge caching. Let's Encrypt SSL.  
* **Database:** PostgreSQL hosted locally on the EC2 instance (bound strictly to 127.0.0.1, EBS volume encrypted at rest).  
* **Session & Caching Layer:** Redis hosted locally on the EC2 instance (bound to 127.0.0.1, password-protected, with maxmemory eviction limits).  
* **Asynchronous Messaging / Kitchen Dispatch:** AWS SQS (Simple Queue Service).  
* **Maps:** MapLibre GL JS with a MapTiler style (retaining the existing brand styling and fallback logic).

## Security & Hardening Requirements

* **Database & Cache Binding:** PostgreSQL and Redis must bind strictly to `127.0.0.1` (localhost). AWS Security Groups must block all public inbound traffic to ports 5432 and 6379.
* **Secret Management:** All credentials, database URLs, and API keys must be loaded exclusively via environment variables (`.env`). Ensure file permissions are restricted (`chmod 600`) on the server.
* **Secure Session Cookies:** Redis session cookies must be configured with `HttpOnly`, `Secure`, and `SameSite=Strict` flags.
* **Rate Limiting:** Implement rate-limiting logic on authentication endpoints (login/register) to prevent brute-force attacks and abuse.

## **Core Features & Requirements to Build**

### **1\. User Authentication & Session Management**

* **Auth Flow:** Secure user registration and login (Email/Password with bcrypt hashing).  
* **Server-Side Sessions:** Store user sessions and active shopping carts in **Redis** rather than stateless JWTs. Use secure, HTTP-only, SameSite=Strict cookies containing only the session ID.  
* **Protected Routes:** Secure user profile and order history routes (/cuenta, /historial) ensuring users can only view their own data.  
* **Secure Password Hashing (Salt & Pepper):** Passwords must be securely hashed using **Argon2id** (or bcrypt with a strong work factor). Every user record must include a unique salt generated at registration. Implement a **server-side secret pepper** stored strictly in the EC2 environment variables (never in the database) to protect against database compromise. 

### **2\. Menu Catalog, Dynamic Ordering & Payment Integration**

* **Shared Database Catalog:** Migrate the static TypeScript menu data (lib/menu-data.ts) and pickup/delivery zones into PostgreSQL relational tables (dishes, categories, delivery\_zones, pickup\_points).  
* **Checkout & Payment Processing (Zero PCI-DSS Scope):** Integrate a secure third-party payment gateway (e.g., Stripe Checkout / Stripe Elements or Openpay) via hosted fields/redirects. **Do not store, handle, or log raw credit card numbers, CVVs, or bank details on the EC2 server.** The database should only store gateway transaction tokens, payment status, and order totals.   
* **Order Creation State:** Upon successful payment, write the order to PostgreSQL with a status of paid or confirmed.

### **3\. Kitchen Dispatch, SQS & Automated Receipt Printing**

* **Routing Logic:** Implement logic to tag orders with the correct Tijuana kitchen facility or fulfillment route based on the selected delivery zone or pickup point (e.g., Zona Río vs. Playas).  
* **AWS SQS Integration:** Immediately after an order is successfully paid and recorded in PostgreSQL, push the order payload to an AWS SQS queue.  
* **Kitchen Print Daemon Spec:** Provide a lightweight Node.js polling script/daemon design that pulls from SQS, formats a thermal receipt template, and triggers a local kitchen receipt printer.

### **4\. Kitchen Staff Dashboard**

* **Live View:** Build a secure internal dashboard route (/kitchen/dashboard) restricted to kitchen staff accounts.  
* **Order Lifecycle Management:** Real-time interface allowing staff to view active orders assigned to their kitchen, filter by status (Pending, Preparing, Ready for Pickup/Delivery, Completed), and update order statuses.

## **Data Schema Requirements (PostgreSQL)**

Please design and generate the SQL migration scripts for the following tables:

1. **dishes & categories**: Storing meal names, descriptions, pricing in MXN, category types (high protein, balanced, light, breakfast), and active availability flags.  
2. **delivery\_zones & pickup\_points**: Storing Tijuana locations, operational hours, and delivery day constraints.  
3. **users**: Storing customer ID, name, email, hashed password, phone number, and timestamps.  
4. **orders & order\_items**: Storing user reference, total amount in MXN, payment reference ID, fulfillment type (delivery vs. pickup), delivery zone / pickup point address, current order status, and relational line items.

## **Deliverables Expected from the AI Assistant**

1. **Project File Structure:** Recommended folder structure for the Next.js App Router project supporting server actions, database connectors, and Redis session stores.  
2. **Database Configuration & Schema:** Complete SQL schema file (schema.sql) for PostgreSQL.  
3. **Redis Session Configuration:** Code snippet/configuration for connecting Next.js to local Redis for server-side session and cart management.  
4. **Order Placement & SQS Dispatch Logic:** Backend service code showing how an order transaction is committed to PostgreSQL and dispatched to AWS SQS.  
5. **Kitchen Dashboard Component Layout:** A functional React server/client component layout for the kitchen staff order management screen.