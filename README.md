# Introducing TuneTrees: Digital Repertoire Companion

Are you a folk or traditional musician struggling to keep track of your vast repertoire? TuneKeeper is here to help. This app is designed to simplify the process of memorizing and practicing large collections of tunes, making it easier than ever to hone your skills and and be ready to play in spontaneous group settings.

TuneTrees is designed to help folk musicians efficiently memorize and retain a large repertoire of tunes. By combining proven memory techniques like spaced repetition, mnemonics, and spatial navigation, the app assists in training musical memory. In the future, TuneTrees may explore the use of advanced technologies like neural networks and reinforcement learning to further enhance the memorization process.

See the [Tune Trees Project Whitepaper](docs/core-proposal.md#tune-trees-project-whitepaper)
to get some insight into the vision of the project.

## Design and Intent

TuneTrees is a web application with a backend server that manages user data and schedules reviews. The backend securely stores all data in a database, while the frontend handles user interactions like login, account management, and practicing tunes. The frontend communicates with the backend using an HTTP API to access and update user data. Both the frontend and backend are packaged as containers and deployed together using Docker Compose on a DigitalOcean server.

```mermaid
flowchart LR
    subgraph Backend
        direction LR
        A(Backend Server) --> B(Database)
        A --> C(Review Scheduler)
    end
    subgraph Frontend
        direction LR
        D(Frontend) --> E(HTTP API)
    end
    E --> A
    D --> F(User Management)
    D --> G(Tune Practice)
    D --> H(Login/Logout)
```

Note: This diagram provides a high-level overview of the app's architecture. Specific implementation details may evolve.

```mermaid
flowchart LR
    subgraph Backend
        direction LR
        A(FastAPI Server) --> B(SQLite Database)
        A --> C(SM2 Algorithm)
    end
    subgraph Frontend
        direction LR
        D(React) --> E(Next.js)
        E --> F(NextAuth.js)
    end
    A --> E
```

#### Backend:

Handles user data management, review scheduling, and API requests.
- Database: Stores user data, including tunes, practice history, and review schedules.
- Review Scheduler: Determines when tunes should be reviewed based on the user's progress.

#### Frontend:

Handles user interactions, including login, account management, and tune practice.
- HTTP API: Communicates with the backend to access and update user data.
- User Management: Handles user registration, login, and account settings.
- Tune Practice: Provides tools for practicing tunes and tracking progress.
- Login/Logout: Implements authentication and authorization.

### Schema:

The database is organized as follows: Each user can have multiple playlists, and each playlist is associated with a specific musical instrument. These playlists contain tunes, which are stored separately and shared across all users. TuneTrees doesn't aim to be a complete tune repository, so it only stores basic tune information. For more detailed details, users can refer to external resources.

The complete entity relationship diagram is illustrated by the following diagram:

```mermaid
classDiagram
direction BT
class account {
   text provider
   text type
   text access_token
   text id_token
   text refresh_token
   text scope
   integer expires_at
   text session_state
   text token_type
   text user_id
   text provider_account_id
}
class playlist {
   integer USER_REF
   text instrument
   integer PLAYLIST_ID
}
class playlist_tune {
   integer PLAYLIST_REF
   text TUNE_REF
   text Current
   text Learned
}
class practice_list_joined {
   integer ID
   text Title
   text Type
   text Structure
   text Mode
   text Incipit
   text Learned
   text Practiced
   text Quality
   real Easiness
   integer Interval
   integer Repetitions
   integer ReviewDate
   text BackupPracticed
   text NotePrivate
   text NotePublic
   text Tags
}
class practice_record {
   integer PLAYLIST_REF
   text TUNE_REF
   text Practiced
   text Quality
   real Easiness
   integer Interval
   integer Repetitions
   integer ReviewDate
   text BackupPracticed
   integer ID
}
class session {
   text expires
   text user_id
   text session_token
}
class sqlite_master {
   text type
   text name
   text tbl_name
   int rootpage
   text sql
}
class sqlite_sequence {
   unknown name
   unknown seq
}
class tune {
   text Type
   text Structure
   text Title
   text Mode
   text Incipit
   integer ID
}
class user {
   text hash
   text first_name
   text middle_name
   text last_name
   text email
   text user_name
   text email_verified
   text image
   integer ID
}
class user_annotation_set {
   text TUNE_REF
   text NotePrivate
   text NotePublic
   text Tags
   integer USER_REF
}
class verification_token {
   text token
   text expires
   text identifier
}

account  -->  user : user_id
playlist  -->  user : USER_REF
playlist_tune  -->  playlist : PLAYLIST_REF
playlist_tune  -->  tune : TUNE_REF
practice_record  -->  playlist : PLAYLIST_REF
practice_record  -->  tune : TUNE_REF
session  -->  user : user_id
user_annotation_set  -->  tune : TUNE_REF
user_annotation_set  -->  user : USER_REF
```

### Alternatives or Potential Technology Evolution

1. Down the line, I can switch to MySQL or PostgreSQL if needed.
2. For the front end, I may experiment with a Kotlin frontend at some point.
