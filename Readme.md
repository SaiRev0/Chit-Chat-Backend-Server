> I'm **Saiyam Jain** from the **Mechanical Engineering** Department of **IIT (BHU) Varanasi**

# Chit-Chat - Real-Time Chat, Voice, and Video Calling Platform

Chit-Chat is a real-time chatting platform that also supports voice and video calling. The frontend is built with ReactJS using Vite, and the backend is developed using Node.js, Express, and MongoDB as the NoSQL database.

## Project Dependencies

The project utilizes the following packages for various functionalities:

- `bcryptjs`: Used for hashing and salting user passwords.
- `body-parser`: Middleware for parsing incoming request bodies.
- `cookie-parser`: Middleware for parsing cookies.
- `cookie-session`: Middleware for session management using cookies.
- `cors`: Enables Cross-Origin Resource Sharing, allowing the frontend to communicate with the backend.
- `dotenv`: Load environment variables from a .env file.
- `express`: A minimal and flexible Node.js web application framework.
- `express-mongo-sanitize`: Helps prevent MongoDB NoSQL injection.
- `helmet`: Enhances security by setting various HTTP headers.
- `jsonwebtoken`: Used for creating JSON Web Tokens (JWT) for authentication.
- `mongoose`: An ODM library for MongoDB, simplifying database interactions.
- `socket.io`: Enables real-time, bidirectional communication between the server and clients.
- `xss-clean`: Protects against cross-site scripting (XSS) attacks.

## Database System Design

![Database_System_Diagram](https://github.com/SaiRev0/Chit-Chat-Backend-Server/assets/96655163/d37c81ca-c27b-4943-b877-1d6c6cba653e)

## Setup and Run the Project Locally

To set up and run the project on your local machine, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/SaiRev0/Chit-Chat-Backend-Server.git
   cd Chit-Chat-Backend
   ```

2. Create a `.env` file in the project root directory and add the following variables:

   ```env
   PORT="Set the port number for the server"
   DATABASE_PASSWORD="Your MongoDB database password"
   DATABASE="Your MongoDB database URL"
   JWT_SECRET="A secret key for JWT token generation"
   ZEGO_APP_ID="Zegocloud App ID for voice and video calling"
   ZEGO_SERVER_SECRET="Zegocloud Server Secret for authentication"
   ```

3. Install project dependencies `npm install`

4. Start the server with nodemon: `npm start` or without nodemon: `node server.js`

> The project should now be up and running locally, allowing you to chat, make voice calls, and video calls in real-time

---
