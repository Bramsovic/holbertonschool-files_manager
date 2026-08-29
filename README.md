# Files Manager

A backend file management API built with **Node.js, Express, MongoDB and Redis** as part of the Holberton School curriculum.

The project provides user authentication, file and folder management, access control, persistent metadata storage and asynchronous image processing.

## Overview

Files Manager is a REST API designed to explore how several backend technologies can work together within the same application.

The application combines:

- **Express** for the HTTP API
- **MongoDB** for persistent data
- **Redis** for temporary authentication sessions
- **Bull** for background jobs
- Local filesystem storage for uploaded files
- A dedicated worker for asynchronous image processing

## Features

### User management

Users can create an account with an email address and password.

The API prevents duplicate email addresses and stores user information in MongoDB.

### Authentication

Authentication is based on temporary tokens.

The authentication flow is:

```text
Credentials
    ↓
Basic Authentication
    ↓
Token generation
    ↓
Redis session
    ↓
X-Token authentication
```

Authentication tokens are stored in Redis with a **24-hour expiration**.

Users can also explicitly disconnect and invalidate their session.

### File management

Authenticated users can upload and manage:

- Files
- Images
- Folders

Files can be organized through parent folders, allowing a basic hierarchical file structure.

Each stored resource contains metadata such as:

```text
id
userId
name
type
isPublic
parentId
```

Uploaded file contents are stored on the local filesystem while their metadata is stored in MongoDB.

### Public and private files

Files are private by default but can be published or unpublished through the API.

Private files can only be accessed by their owner.

Public files can be retrieved without authentication.

### Pagination

The files endpoint supports pagination.

Files are returned in groups of **20 items per page**.

### Asynchronous image processing

Image processing is handled outside the main HTTP request cycle.

When an image is uploaded, the API adds a job to a **Bull queue**.

```text
Image upload
     ↓
Express API
     ↓
MongoDB metadata
     ↓
Bull Queue
     ↓
Background Worker
     ↓
Thumbnail generation
```

The worker generates three thumbnail sizes:

- 500 px
- 250 px
- 100 px

This architecture separates expensive image processing from regular API requests.

## Architecture

```text
                    ┌──────────────┐
                    │    Client    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Express API  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
         ┌─────────┐  ┌─────────┐  ┌────────────┐
         │ MongoDB │  │  Redis  │  │ Filesystem │
         └─────────┘  └─────────┘  └────────────┘
              │
              │ Image upload
              ▼
         ┌──────────┐
         │Bull Queue│
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │  Worker  │
         └────┬─────┘
              │
              ▼
      Thumbnail generation
       500 / 250 / 100 px
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/status` | Check MongoDB and Redis status |
| `GET` | `/stats` | Return number of users and files |
| `POST` | `/users` | Create a user |
| `GET` | `/connect` | Authenticate and generate a token |
| `GET` | `/disconnect` | Invalidate the current token |
| `GET` | `/users/me` | Retrieve authenticated user |
| `POST` | `/files` | Upload a file, image or folder |
| `GET` | `/files` | List user files |
| `GET` | `/files/:id` | Retrieve file metadata |
| `GET` | `/files/:id/data` | Retrieve file content |
| `PUT` | `/files/:id/publish` | Make a file public |
| `PUT` | `/files/:id/unpublish` | Make a file private |

## Project Structure

```text
holbertonschool-files_manager/
│
├── controllers/
│   ├── AppController.js
│   ├── AuthController.js
│   ├── FilesController.js
│   └── UsersController.js
│
├── routes/
│   └── index.js
│
├── utils/
│   ├── db.js
│   └── redis.js
│
├── server.js
├── worker.js
├── package.json
└── README.md
```

### Controllers

`AppController`

Handles service health checks and application statistics.

`AuthController`

Handles authentication, token creation and logout.

`UsersController`

Handles user creation and authenticated user retrieval.

`FilesController`

Handles file uploads, hierarchy, pagination, publishing and file retrieval.

### Utils

`db.js`

Provides the MongoDB connection and access to the users and files collections.

`redis.js`

Provides the Redis connection and helpers used by the authentication system.

### Worker

`worker.js`

Consumes image-processing jobs from the Bull queue and generates thumbnails asynchronously.

## Tech Stack

### Backend

- Node.js
- Express
- JavaScript / ES6

### Data

- MongoDB
- Redis

### Background processing

- Bull

### File processing

- Node.js filesystem API
- image-thumbnail
- mime-types
- UUID

### Testing & Development

- Mocha
- Chai
- Sinon
- ESLint
- Babel
- Nodemon

## Installation

### Requirements

Make sure the following services are installed and running:

- Node.js
- MongoDB
- Redis

Clone the repository:

```bash
git clone https://github.com/Bramsovic/holbertonschool-files_manager.git
cd holbertonschool-files_manager
```

Install dependencies:

```bash
npm install
```

## Environment

The MongoDB connection can be configured with:

```bash
DB_HOST
DB_PORT
DB_DATABASE
```

Default values:

```text
DB_HOST=localhost
DB_PORT=27017
DB_DATABASE=files_manager
```

Uploaded files are stored by default in:

```text
/tmp/files_manager
```

This can be changed with:

```bash
FOLDER_PATH
```

## Running the project

Start the API server:

```bash
npm run start-server
```

Start the background worker in another terminal:

```bash
npm run start-worker
```

MongoDB and Redis must also be running.

## Example workflow

### 1. Create a user

```http
POST /users
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

### 2. Authenticate

```http
GET /connect
Authorization: Basic <base64-credentials>
```

Response:

```json
{
  "token": "authentication-token"
}
```

### 3. Upload a file

Authenticated requests use:

```http
X-Token: authentication-token
```

An uploaded image is stored locally and automatically sent to the background processing queue.

### 4. Retrieve files

```http
GET /files?page=0
X-Token: authentication-token
```

### 5. Publish a file

```http
PUT /files/:id/publish
X-Token: authentication-token
```

## What I learned

This project helped me understand how different backend components can work together inside one application:

- Designing a REST API
- Working with MongoDB
- Using Redis for temporary session storage
- Managing authentication tokens
- Handling file storage
- Implementing access control
- Working with asynchronous job queues
- Processing images in background workers
- Separating application responsibilities into controllers, routes and utilities

It was particularly useful for understanding why expensive tasks such as image processing can be moved outside the HTTP request lifecycle.

## Security note

This project was developed as part of a learning curriculum.

Some implementation choices reflect the educational requirements of the project rather than current production standards. For example, password hashing uses SHA-1.

A production implementation should use a modern password hashing algorithm such as **Argon2** or **bcrypt**, alongside additional security controls.

## Author

**Brahim Haddad**

Holberton School — Backend project
