StudioSpace — Backend

StudioSpace Backend provides REST APIs for studio discovery, availability checking, user authentication, and booking management.

Features
RESTful API built with Express.js and TypeScript.
MongoDB Atlas database integration.
Better Auth authentication and JWT verification.
Retrieve all studios and filter by category.
Retrieve featured studios and individual studio details.
Create bookings with automatic price calculation.
Prevent overlapping active bookings.
Cancel pending bookings.

Technology Stack
Runtime: Node.js.
Framework: Express.js 5.
Language: TypeScript.
Database: MongoDB Atlas.

Authentication: Better Auth, JWT.

JWT Verification: JOSE.

Middleware: CORS, dotenv.

Deployment: Vercel.

Local Setup Instructions :
Install dependencies:
npm install

Create a .env file in the server root:
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB_NAME=studiospace
BETTER_AUTH_SECRET=your_secure_secret
BETTER_AUTH_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

Start the development server:
npm run dev

Run TypeScript verification:
npm run typecheck

Build the project:
npm run build

Live Backend
https://a8-studio-space-server.vercel.app

Examiner Test Credentials
Use the examiner account provided in the client README.

GitHub Repository
https://github.com/ArifsCreative/a8-studio-space-server